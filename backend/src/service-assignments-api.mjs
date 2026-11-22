import { isCalendarDate } from './calendar.mjs';
import { serviceCodePattern } from './tariffs.mjs';

const assignmentErrors = {
  REQUEST_NOT_FOUND: [404, 'No encontramos esa solicitud.'],
  REQUEST_ASSIGNED: [409, 'La solicitud ya tiene una asignación. Actualiza la lista.'],
  SLOT_STARTED: [409, 'La franja solicitada ya empezó.'],
  TARIFF_UNAVAILABLE: [409, 'El servicio no tiene una tarifa vigente.'],
  TARIFF_CHANGED: [409, 'Cambió la tarifa oficial. Vuelve a consultar el monto antes de confirmar.'],
  STEVEDORE_NOT_ELIGIBLE: [409, 'El estibador no está verificado o ya no tiene credencial activa.'],
  SLOT_OVERLAP: [409, 'El estibador ya tiene otro servicio que se superpone con esta franja.'],
};

function limaTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
    || !isCalendarDate(value.slice(0, 10))) return NaN;
  return Date.parse(value + ':00-05:00');
}

export function mountServiceAssignments(app, store, { ApiError, now, requireUser, json }) {
  function requireCoordinator(req, _res, next) {
    if (!store.hasStevedoreRole(req.user.id, 'coordinator')) {
      return next(new ApiError(403, 'COORDINATOR_REQUIRED', 'Solo el coordinador de estibaje puede asignar servicios.'));
    }
    next();
  }

  function check(result) {
    if (result.error) {
      const [status, message] = assignmentErrors[result.error];
      throw new ApiError(status, result.error, message);
    }
  }

  app.get('/api/stevedore-service-requests', requireUser, (req, res) => {
    const canAssign = store.hasStevedoreRole(req.user.id, 'coordinator');
    res.json({ canAssign, requests: store.listServiceRequests(req.user.id, canAssign) });
  });

  app.post('/api/stevedore-service-requests', requireUser, json, (req, res) => {
    if (req.user.role !== 'merchant') throw new ApiError(403, 'MERCHANT_REQUIRED', 'Solo una cuenta de comerciante puede solicitar un servicio.');
    const { serviceCode, start, end } = req.body ?? {};
    const startsAt = limaTimestamp(start);
    const endsAt = limaTimestamp(end);
    const current = now();
    const fields = {};
    if (typeof serviceCode !== 'string' || !serviceCodePattern.test(serviceCode)) fields.serviceCode = 'Elige un servicio del catálogo.';
    if (!Number.isFinite(startsAt) || startsAt <= current) fields.start = 'Ingresa una fecha y hora futuras.';
    if (!Number.isFinite(endsAt) || endsAt <= startsAt) fields.end = 'Ingresa una hora posterior al inicio.';
    if (Object.keys(fields).length) throw new ApiError(400, 'INVALID_FIELDS', 'Revisa el servicio y la franja.', fields);
    const request = store.createServiceRequest(req.user.id, { serviceCode, startsAt, endsAt }, current);
    if (!request) throw new ApiError(400, 'INVALID_FIELDS', 'El servicio no está en el catálogo.', { serviceCode: 'Elige un servicio del catálogo.' });
    res.status(201).json({ request });
  });

  app.get('/api/stevedore-service-requests/:code/options', requireUser, requireCoordinator, (req, res) => {
    const result = store.serviceAssignmentOptions(req.params.code.toUpperCase(), now());
    check(result);
    res.json(result);
  });

  app.post('/api/stevedore-service-requests/:code/assignment', requireUser, requireCoordinator, json, (req, res) => {
    const { caseCode, tariffVersion } = req.body ?? {};
    if (typeof caseCode !== 'string' || !/^ES-[A-F0-9]{16}$/.test(caseCode) || !Number.isSafeInteger(tariffVersion) || tariffVersion < 1) {
      throw new ApiError(400, 'INVALID_FIELDS', 'Elige un estibador y revisa la tarifa antes de confirmar.');
    }
    const result = store.assignStevedoreService(req.params.code.toUpperCase(), caseCode, tariffVersion, req.user.id, now);
    check(result);
    res.status(201).json(result);
  });
}
