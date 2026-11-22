export function logisticsStore(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS logistics_windows (
      id INTEGER PRIMARY KEY,
      bay TEXT NOT NULL,
      date TEXT NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('load', 'unload')),
      starts_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL CHECK (ends_at > starts_at),
      capacity INTEGER NOT NULL CHECK (capacity > 0)
    );
    CREATE INDEX IF NOT EXISTS logistics_windows_date ON logistics_windows(date, operation, starts_at);
  `);

  return {
    addLogisticsWindow({ bay, date, operation, startsAt, endsAt, capacity }) {
      return db.prepare(`INSERT INTO logistics_windows (bay, date, operation, starts_at, ends_at, capacity)
        SELECT ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM logistics_windows WHERE bay = ? AND starts_at < ? AND ends_at > ?)
        RETURNING id`).get(bay, date, operation, startsAt, endsAt, capacity, bay, endsAt, startsAt);
    },
    listLogisticsWindows(date, operation, now) {
      return db.prepare(`SELECT id, bay, starts_at AS startsAt, ends_at AS endsAt, capacity AS remaining
        FROM logistics_windows WHERE date = ? AND operation = ? AND starts_at > ?
        ORDER BY starts_at, bay, id`).all(date, operation, now);
    },
  };
}
