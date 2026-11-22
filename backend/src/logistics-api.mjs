import { normalizePlate, operations, validLogisticsDate } from './logistics-time.mjs';

const accessErrors = {
  BOOKING_NOT_FOUND: [404, 'No encontramos ese turno.'],
  PLATE_MISMATCH: [409, 'La placa no coincide con la registrada en el turno.'],
  OUTSIDE_WINDOW: [409, 'El vehículo está fuera de su ventana. El ingreso queda sin registrar.'],
};

export function mountLogistics(app, store, { ApiError, now, requireUser, json }) {
  function requireAccessAgent(req, _res, next) {
    if (!store.isLogisticsAgent(req.user.id)) return next(new ApiError(403, 'ACCESS_AGENT_REQUIRED', 'Solo el agente de acceso puede registrar movimientos.'));
    next();
  }

  function accessDetails(body) {
    const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
    const plate = normalizePlate(body?.plate);
    const fields = {};
    if (!/^TV-[A-F0-9]{16}$/.test(code)) fields.code = 'Ingresa un código de turno válido.';
    if (!plate) fields.plate = 'Ingresa una placa como ABC-123.';
    if (Object.keys(fields).length) throw new ApiError(400, 'INVALID_FIELDS', 'Revisa el código y la placa.', fields);
    return { code, plate };
  }

  function respondAccess(res, result) {
    if (result.error) {
      const [status, message] = accessErrors[result.error];
      throw new ApiError(status, result.error, message);
    }
    res.json(result);
  }

  app.get('/api/logistics/windows', (req, res) => {
    const { date, operation } = req.query;
    if (!validLogisticsDate(date) || !operations.includes(operation)) {
      throw new ApiError(400, 'INVALID_FILTERS', 'Elige una fecha válida y el tipo de operación.');
    }
    res.json({ date, operation, windows: store.listLogisticsWindows(date, operation, now()) });
  });
  app.get('/api/logistics/bookings', requireUser, (req, res) => {
    res.json({ bookings: store.listLogisticsBookings(req.user.id), canControlAccess: store.isLogisticsAgent(req.user.id) });
  });
  app.post('/api/logistics/access/check', requireUser, requireAccessAgent, json, (req, res) => {
    const { code, plate } = accessDetails(req.body);
    respondAccess(res, store.checkLogisticsEntry(code, plate, now()));
  });
  app.post('/api/logistics/access/entry', requireUser, requireAccessAgent, json, (req, res) => {
    const { code, plate } = accessDetails(req.body);
    respondAccess(res, store.recordLogisticsEntry(code, plate, req.user.id, now));
  });
  app.post('/api/logistics/bookings', requireUser, json, (req, res) => {
    const { windowId } = req.body ?? {};
    const plate = normalizePlate(req.body?.plate);
    if (!Number.isSafeInteger(windowId) || windowId < 1) throw new ApiError(400, 'INVALID_WINDOW', 'Selecciona una ventana para reservar.');
    if (!plate) throw new ApiError(400, 'INVALID_PLATE', 'Ingresa una placa como ABC-123.', { plate: 'Ingresa una placa como ABC-123.' });
    const result = store.reserveLogisticsWindow(req.user.id, windowId, plate, now());
    if (result.error === 'WINDOW_UNAVAILABLE') {
      throw new ApiError(409, result.error, 'La ventana ya no tiene cupos o ya empezó. Elige otro horario.');
    }
    if (result.error === 'PLATE_OVERLAP') {
      throw new ApiError(409, result.error, 'Esta placa ya tiene un turno que coincide con ese horario.');
    }
    res.status(201).json(result);
  });
}
