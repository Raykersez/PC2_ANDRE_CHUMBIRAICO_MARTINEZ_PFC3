import { checklistVersion, inspectionAnswers, sanitaryChecklist, submissionPattern } from './sanitary-checklist.mjs';

export function mountSanitary(app, store, { ApiError, now, requireUser, json }) {
  function requireInspector(req, _res, next) {
    if (!store.hasSanitaryRole(req.user.id, 'inspector')) {
      return next(new ApiError(403, 'INSPECTOR_REQUIRED', 'Solo la cuenta inspectora puede realizar esta acción.'));
    }
    next();
  }

  app.get('/api/sanitary', requireUser, (req, res) => {
    res.json({ canInspect: store.hasSanitaryRole(req.user.id, 'inspector') });
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
