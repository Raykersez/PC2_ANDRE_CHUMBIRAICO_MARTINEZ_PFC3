const limaCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function limaDate(timestamp) {
  const parts = Object.fromEntries(limaCalendar.formatToParts(timestamp).map(({ type, value }) => [type, value]));
  return [parts.year, parts.month, parts.day].join('-');
}

export function isCalendarDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !date.startsWith('0000')
    && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
