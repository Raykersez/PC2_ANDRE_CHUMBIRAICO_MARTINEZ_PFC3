import { isCalendarDate } from './calendar.mjs';

export const serviceCodePattern = /^[A-Z0-9][A-Z0-9-]{0,31}$/;

export function parseTariffCommand(action, args) {
  const [rawCode, value, rawUnit, startsOn, endsOn] = args;
  const code = rawCode?.trim().toUpperCase();
  if (!code || !serviceCodePattern.test(code)) return;
  if (action === '--servicio' && args.length === 2) {
    const name = value.trim();
    if (name && name.length <= 120) return { type: 'service', code, name };
  }
  if (action === '--tarifa' && (args.length === 4 || args.length === 5)) {
    const cents = Number(value);
    const unit = rawUnit.trim();
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(cents) || !unit || unit.length > 80) return;
    if (!isCalendarDate(startsOn) || (endsOn !== undefined && (!isCalendarDate(endsOn) || endsOn <= startsOn))) return;
    return { type: 'rate', code, cents, unit, startsOn, endsOn: endsOn ?? null };
  }
}

export function tariffStore(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stevedore_services (
      code TEXT PRIMARY KEY, name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stevedore_tariff_versions (
      id INTEGER PRIMARY KEY,
      service_code TEXT NOT NULL REFERENCES stevedore_services(code),
      amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
      unit TEXT NOT NULL,
      starts_on TEXT NOT NULL,
      ends_on TEXT CHECK (ends_on > starts_on),
      UNIQUE (service_code, starts_on)
    );
  `);

  return {
    addStevedoreService({ code, name }) {
      return db.prepare('INSERT INTO stevedore_services VALUES (?, ?) ON CONFLICT DO NOTHING')
        .run(code, name).changes > 0;
    },
    addStevedoreTariff({ code, cents, unit, startsOn, endsOn }) {
      return db.prepare(`INSERT INTO stevedore_tariff_versions (service_code, amount_cents, unit, starts_on, ends_on)
        SELECT code, ?, ?, ?, ? FROM stevedore_services WHERE code = ?
        ON CONFLICT(service_code, starts_on) DO NOTHING RETURNING id`).get(cents, unit, startsOn, endsOn, code);
    },
    listStevedoreTariffs(asOf, serviceCode = null) {
      const rows = db.prepare(`SELECT s.code, s.name, t.id, t.amount_cents AS cents,
        t.unit, t.starts_on AS startsOn, t.ends_on AS endsOn
        FROM stevedore_services s
        LEFT JOIN stevedore_tariff_versions t ON t.id = (
          SELECT latest.id FROM stevedore_tariff_versions latest
          WHERE latest.service_code = s.code AND latest.starts_on <= ?
          ORDER BY latest.starts_on DESC LIMIT 1
        ) AND (t.ends_on IS NULL OR t.ends_on > ?)
        WHERE (? IS NULL OR s.code = ?)
        ORDER BY s.name, s.code`).all(asOf, asOf, serviceCode, serviceCode);
      return rows.map(({ code, name, id, cents, unit, startsOn, endsOn }) => ({
        code, name, rate: id === null ? null : { id, cents, unit, startsOn, endsOn },
      }));
    },
  };
}
