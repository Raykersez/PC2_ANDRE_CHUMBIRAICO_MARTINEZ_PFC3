import { submissionPattern } from './sanitary-checklist.mjs';
import { wastePointPattern } from './waste-store.mjs';

export function mountWaste(app, store, { ApiError, now, requireUser, json }) {
  function requireRecorder(req, _res, next) {
    if (!store.hasSanitaryRole(req.user.id, 'waste-recorder')) {
      return next(new ApiError(403, 'WASTE_RECORDER_REQUIRED', 'Solo el encargado de residuos puede registrar acopios.'));
    }
    next();
  }

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
