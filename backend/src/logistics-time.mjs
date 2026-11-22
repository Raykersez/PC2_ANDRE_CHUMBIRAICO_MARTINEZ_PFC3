export const operations = ['load', 'unload'];

export function validLogisticsDate(date) {
  return typeof date === 'string' && /^[1-9]\d{3}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}

export function parseWindow(args) {
  const [rawBay, date, start, end, operation, rawCapacity] = args;
  const bay = rawBay?.trim().toUpperCase();
  const capacity = Number(rawCapacity);
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (args.length !== 6 || !/^[A-Z0-9][A-Z0-9-]{0,23}$/.test(bay ?? '') || !validLogisticsDate(date)
      || !clock.test(start) || !(clock.test(end) || end === '24:00') || start >= end
      || !operations.includes(operation) || !/^\d+$/.test(rawCapacity) || !Number.isSafeInteger(capacity) || capacity < 1) return;
  return {
    bay, date, operation, capacity,
    startsAt: Date.parse(date + 'T' + start + ':00-05:00'),
    endsAt: Date.parse(date + 'T' + end + ':00-05:00'),
  };
}
