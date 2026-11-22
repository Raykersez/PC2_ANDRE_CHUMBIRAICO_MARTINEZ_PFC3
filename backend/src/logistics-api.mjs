import { operations, validLogisticsDate } from './logistics-time.mjs';

export function mountLogistics(app, store, { ApiError, now }) {
  app.get('/api/logistics/windows', (req, res) => {
    const { date, operation } = req.query;
    if (!validLogisticsDate(date) || !operations.includes(operation)) {
      throw new ApiError(400, 'INVALID_FILTERS', 'Elige una fecha válida y el tipo de operación.');
    }
    res.json({ date, operation, windows: store.listLogisticsWindows(date, operation, now()) });
  });
}
