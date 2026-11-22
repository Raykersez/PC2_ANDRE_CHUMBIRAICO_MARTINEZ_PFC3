import { normalizePlate, operations, validLogisticsDate } from './logistics-time.mjs';

export function mountLogistics(app, store, { ApiError, now, requireUser, json }) {
  app.get('/api/logistics/windows', (req, res) => {
    const { date, operation } = req.query;
    if (!validLogisticsDate(date) || !operations.includes(operation)) {
      throw new ApiError(400, 'INVALID_FILTERS', 'Elige una fecha válida y el tipo de operación.');
    }
    res.json({ date, operation, windows: store.listLogisticsWindows(date, operation, now()) });
  });
  app.get('/api/logistics/bookings', requireUser, (req, res) => {
    res.json({ bookings: store.listLogisticsBookings(req.user.id) });
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
