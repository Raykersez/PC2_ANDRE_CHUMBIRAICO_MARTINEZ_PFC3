import { checklistVersion, inspectionAnswers, sanitaryChecklist, submissionPattern } from './sanitary-checklist.mjs';
import { isCalendarDate } from './calendar.mjs';

export function mountSanitary(app, store, { ApiError, now, requireUser, json, evidenceForm, readMultipart, readAttachment, sendAttachment }) {
  function requireInspector(req, _res, next) {
    if (!store.hasSanitaryRole(req.user.id, 'inspector')) {
      return next(new ApiError(403, 'INSPECTOR_REQUIRED', 'Solo la cuenta inspectora puede realizar esta acción.'));
    }
    next();
  }

  app.get('/api/sanitary', requireUser, (req, res) => {
    res.json({ canInspect: store.hasSanitaryRole(req.user.id, 'inspector') });
  });
  app.get('/api/sanitary/findings', requireUser, (req, res) => {
    res.json({ findings: store.listSanitaryFindings(req.user.id, store.hasSanitaryRole(req.user.id, 'inspector')) });
  });
  app.get('/api/sanitary/findings/:id/evidence', requireUser, (req, res) => {
    const evidence = store.readSanitaryEvidence(req.params.id, req.user.id, store.hasSanitaryRole(req.user.id, 'inspector'));
    if (!evidence) throw new ApiError(404, 'EVIDENCE_NOT_FOUND', 'No encontramos esa evidencia.');
    sendAttachment(res, evidence, 'evidencia-sanitaria');
  });
  app.get('/api/sanitary/findings/:id/followups', requireUser, (req, res) => {
    const result = store.listSanitaryFollowups(req.params.id, req.user.id, store.hasSanitaryRole(req.user.id, 'inspector'));
    if (!result) throw new ApiError(404, 'FINDING_NOT_FOUND', 'No encontramos ese hallazgo.');
    res.json(result);
  });
  app.post('/api/sanitary/findings/:id/followups', requireUser, requireInspector, json, (req, res) => {
    const { submissionId, result } = req.body ?? {};
    const detail = typeof req.body?.detail === 'string' ? req.body.detail.trim() : '';
    const fields = {};
    if (result !== 'compliant' && result !== 'noncompliant') fields.result = 'Elige el resultado de la reinspección.';
    if (!detail || detail.length > 1000) fields.detail = 'Describe la evidencia de subsanación o el motivo por el que persiste el hallazgo.';
    if (Object.keys(fields).length) throw new ApiError(400, 'INVALID_FIELDS', 'Revisa los campos marcados.', fields);
    if (typeof submissionId !== 'string' || !submissionPattern.test(submissionId)) throw new ApiError(400, 'INVALID_SUBMISSION', 'Vuelve a abrir el seguimiento.');
    const saved = store.recordSanitaryFollowup(req.params.id, req.user.id, { submissionId, result, detail }, now);
    if (saved.error === 'FINDING_NOT_FOUND') throw new ApiError(404, saved.error, 'No encontramos ese hallazgo.');
    if (saved.error === 'FINDING_CLOSED') throw new ApiError(409, saved.error, 'El hallazgo ya está cerrado. Actualiza el historial.');
    if (saved.error === 'SUBMISSION_CONFLICT') throw new ApiError(409, saved.error, 'El envío ya se registró con datos distintos. Actualiza el historial.');
    res.status(saved.created ? 201 : 200).json(saved);
  });
  app.post('/api/sanitary/findings', requireUser, requireInspector, evidenceForm, async (req, res) => {
    const form = await readMultipart(req);
    const read = (key) => typeof form.get(key) === 'string' ? form.get(key).trim() : '';
    const [inspectionId, criterion, description, correctiveAction, dueOn] =
      ['inspectionId', 'criterion', 'description', 'correctiveAction', 'dueOn'].map(read);
    const fields = {};
    if (!submissionPattern.test(inspectionId)) fields.inspectionId = 'Elige una inspección.';
    if (!sanitaryChecklist.some(({ code }) => code === criterion)) fields.criterion = 'Selecciona un criterio no conforme.';
    if (!description || description.length > 1000) fields.description = 'Describe el incumplimiento en hasta 1000 caracteres.';
    if (!correctiveAction || correctiveAction.length > 1000) fields.correctiveAction = 'Indica la acción correctiva en hasta 1000 caracteres.';
    if (!isCalendarDate(dueOn)) fields.dueOn = 'Ingresa una fecha válida.';
    const file = form.get('evidence');
    const provided = form.getAll('evidence').length > 1 || (file && (!(file instanceof File) || file.name || file.size));
    const evidence = provided ? await readAttachment(form, 'evidence', fields) : undefined;
    if (Object.keys(fields).length) throw new ApiError(400, 'INVALID_FIELDS', 'Revisa los campos marcados.', fields);
    const result = store.createSanitaryFinding(req.user.id, { inspectionId, criterion, description, correctiveAction, dueOn, evidence }, now);
    if (result.error === 'INSPECTION_NOT_FOUND') throw new ApiError(404, result.error, 'No encontramos esa inspección.');
    if (result.error === 'CRITERION_COMPLIANT') throw new ApiError(400, result.error, 'El criterio no figura como no conforme.', { criterion: 'Elige un criterio no conforme.' });
    if (result.error === 'DEADLINE_TOO_EARLY') throw new ApiError(400, result.error, 'La fecha límite es anterior a la inspección.', { dueOn: 'Elige el día de la inspección o uno posterior.' });
    res.status(201).json(result);
  });
  app.get('/api/sanitary/inspections', requireUser, requireInspector, (req, res) => {
    const stallCode = req.query.stallCode;
    if (stallCode !== undefined && (typeof stallCode !== 'string' || !/^[A-Z0-9][A-Z0-9-]{0,23}$/.test(stallCode))) {
      throw new ApiError(400, 'INVALID_STALL', 'Selecciona un puesto válido.');
    }
    res.json({
      checklist: { version: checklistVersion, criteria: sanitaryChecklist },
      stalls: store.sanitaryStalls(),
      inspections: store.listSanitaryInspections(stallCode),
    });
  });
  app.post('/api/sanitary/inspections', requireUser, requireInspector, json, (req, res) => {
    const { stallCode, submissionId, version } = req.body ?? {};
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
    const { answers, result, fields = {} } = inspectionAnswers(req.body?.answers);
    if (typeof stallCode !== 'string' || !/^[A-Z0-9][A-Z0-9-]{0,23}$/.test(stallCode)) fields.stallCode = 'Elige un puesto.';
    if (notes.length > 1000) fields.notes = 'Las observaciones admiten hasta 1000 caracteres.';
    if (Object.keys(fields).length) throw new ApiError(400, 'INVALID_FIELDS', 'Completa los campos marcados. Tu borrador sigue disponible.', fields);
    if (version !== checklistVersion || typeof submissionId !== 'string' || !submissionPattern.test(submissionId)) {
      throw new ApiError(400, 'INVALID_SUBMISSION', 'Actualiza la lista de verificación antes de enviar.');
    }
    const saved = store.saveSanitaryInspection(req.user.id, { stallCode, submissionId, answers, result, notes }, now);
    if (saved.error === 'STALL_NOT_FOUND') throw new ApiError(400, saved.error, 'El puesto no existe.', { stallCode: 'Elige un puesto del catálogo.' });
    if (saved.error === 'SUBMISSION_CONFLICT') throw new ApiError(409, saved.error, 'El borrador ya se guardó con datos distintos. Actualiza el historial antes de registrar otro.');
    res.status(saved.created ? 201 : 200).json({ inspection: saved.inspection });
  });
}
