import { submissionPattern } from './sanitary-checklist.mjs';
import { wastePointPattern } from './waste-store.mjs';
import { isCalendarDate } from './calendar.mjs';

export function mountWaste(app, store, { ApiError, now, requireUser, json }) {
  function requireRecorder(req, _res, next) {
    if (!store.hasSanitaryRole(req.user.id, 'waste-recorder')) {
      return next(new ApiError(403, 'WASTE_RECORDER_REQUIRED', 'Solo el encargado de residuos puede registrar acopios.'));
    }
    next();
  }
  function requireSupervisor(req, _res, next) {
    if (!store.hasSanitaryRole(req.user.id, 'waste-supervisor')) {
      return next(new ApiError(403, 'WASTE_SUPERVISOR_REQUIRED', 'Solo la supervisión de limpieza puede consultar el resumen.'));
    }
    next();
  }
  app.get('/api/waste/zones', requireUser, requireSupervisor, (_req, res) => {
    res.json({ zones: store.wasteZones() });
  });
  app.get('/api/waste/summary', requireUser, requireSupervisor, (req, res) => {
    const { from, to, zone = '' } = req.query;
    const fields = {};
    if (!isCalendarDate(from)) fields.from = 'Ingresa una fecha inicial válida.';
    if (!isCalendarDate(to)) fields.to = 'Ingresa una fecha final válida.';
    if (!fields.from && !fields.to && to < from) fields.to = 'La fecha final debe ser igual o posterior a la inicial.';
    if (typeof zone !== 'string' || zone.length > 120) fields.zone = 'Selecciona una zona válida.';
    if (Object.keys(fields).length) throw new ApiError(400, 'INVALID_FILTERS', 'Revisa los filtros del resumen.', fields);
    const start = Date.parse(from + 'T00:00:00-05:00');
    const end = Date.parse(to + 'T00:00:00-05:00') + 86_400_000;
    res.json({ from, to, zone, ...store.summarizeWaste(zone, start, end) });
  });

  app.get('/api/waste/collections', requireUser, requireRecorder, (req, res) => {
    res.json(store.listWasteCollections(req.user.id));
  });
  app.post('/api/waste/collections', requireUser, requireRecorder, json, (req, res) => {
    const { submissionId, pointCode, weightKg } = req.body ?? {};
    const grams = Number.isFinite(weightKg) ? Math.round(weightKg * 1000) : NaN;
    const fields = {};
    if (typeof pointCode !== 'string' || !wastePointPattern.test(pointCode)) fields.pointCode = 'Elige un punto de acopio activo.';
    if (!Number.isSafeInteger(grams) || grams < 1 || grams / 1000 !== weightKg) {
      fields.weightKg = 'Ingresa un peso mayor que cero, con hasta tres decimales en kilogramos.';
    }
    if (Object.keys(fields).length) throw new ApiError(400, 'INVALID_FIELDS', 'Corrige los datos del acopio.', fields);
    if (typeof submissionId !== 'string' || !submissionPattern.test(submissionId)) {
      throw new ApiError(400, 'INVALID_SUBMISSION', 'Vuelve a abrir el formulario.');
    }
    const result = store.recordWasteCollection(req.user.id, { submissionId, pointCode, grams }, now());
    if (result.error === 'POINT_UNAVAILABLE') throw new ApiError(400, result.error, 'El punto de acopio no está activo.', { pointCode: 'Elige un punto activo.' });
    if (result.error === 'SUBMISSION_CONFLICT') throw new ApiError(409, result.error, 'El envío ya se registró con datos distintos. Actualiza el historial antes de reintentar.');
    res.status(result.created ? 201 : 200).json(result);
  });
}
