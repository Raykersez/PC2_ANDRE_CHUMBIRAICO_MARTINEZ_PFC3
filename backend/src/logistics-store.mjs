import { randomBytes } from 'node:crypto';

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
    CREATE TABLE IF NOT EXISTS logistics_bookings (
      code TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES accounts(id),
      window_id INTEGER NOT NULL REFERENCES logistics_windows(id),
      plate TEXT NOT NULL,
      confirmed_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS logistics_bookings_window ON logistics_bookings(window_id);
    CREATE INDEX IF NOT EXISTS logistics_bookings_plate ON logistics_bookings(plate);
    CREATE INDEX IF NOT EXISTS logistics_bookings_owner ON logistics_bookings(owner_id);
    CREATE TABLE IF NOT EXISTS logistics_access_agents (
      account_id TEXT PRIMARY KEY REFERENCES accounts(id)
    );
    CREATE TABLE IF NOT EXISTS logistics_entries (
      booking_code TEXT PRIMARY KEY REFERENCES logistics_bookings(code),
      agent_id TEXT NOT NULL REFERENCES accounts(id),
      entered_at INTEGER NOT NULL
    );
  `);

  const bookingFields = `b.code, b.plate, w.date, w.operation, w.bay, w.starts_at AS startsAt,
    w.ends_at AS endsAt, e.entered_at AS enteredAt`;
  const bookingsWithWindow = `FROM logistics_bookings b JOIN logistics_windows w ON w.id = b.window_id
    LEFT JOIN logistics_entries e ON e.booking_code = b.code`;

  function findBooking(code) {
    return db.prepare(`SELECT ${bookingFields} ${bookingsWithWindow} WHERE b.code = ?`).get(code);
  }

  function checkLogisticsEntry(code, plate, now) {
    const booking = findBooking(code);
    if (!booking) return { error: 'BOOKING_NOT_FOUND' };
    if (booking.plate !== plate) return { error: 'PLATE_MISMATCH' };
    if (booking.enteredAt !== null) return { booking, repeated: true };
    if (now < booking.startsAt || now >= booking.endsAt) return { error: 'OUTSIDE_WINDOW' };
    return { booking, repeated: false };
  }

  function book(ownerId, windowId, plate, now) {
    const window = db.prepare('SELECT starts_at, ends_at, capacity FROM logistics_windows WHERE id = ?').get(windowId);
    if (!window || window.starts_at <= now) return { error: 'WINDOW_UNAVAILABLE' };
    const taken = db.prepare('SELECT count(*) AS count FROM logistics_bookings WHERE window_id = ?').get(windowId);
    if (taken.count >= window.capacity) return { error: 'WINDOW_UNAVAILABLE' };
    const overlap = db.prepare(`SELECT 1 FROM logistics_bookings b JOIN logistics_windows w ON w.id = b.window_id
      WHERE b.plate = ? AND w.starts_at < ? AND w.ends_at > ? LIMIT 1`).get(plate, window.ends_at, window.starts_at);
    if (overlap) return { error: 'PLATE_OVERLAP' };
    const code = 'TV-' + randomBytes(8).toString('hex').toUpperCase();
    db.prepare('INSERT INTO logistics_bookings VALUES (?, ?, ?, ?, ?)').run(code, ownerId, windowId, plate, now);
    return { booking: findBooking(code) };
  }

  return {
    isLogisticsAgent(accountId) {
      return Boolean(db.prepare('SELECT 1 FROM logistics_access_agents WHERE account_id = ?').get(accountId));
    },
    grantLogisticsAgent(email) {
      const account = db.prepare('SELECT id FROM accounts WHERE email = ?').get(email);
      if (!account) return false;
      db.prepare('INSERT INTO logistics_access_agents VALUES (?) ON CONFLICT DO NOTHING').run(account.id);
      return true;
    },
    checkLogisticsEntry,
    recordLogisticsEntry(code, plate, accountId, clock) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const now = clock();
        const result = checkLogisticsEntry(code, plate, now);
        if (result.booking && !result.repeated) {
          db.prepare('INSERT INTO logistics_entries VALUES (?, ?, ?)').run(code, accountId, now);
          result.booking.enteredAt = now;
        }
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    listLogisticsBookings(ownerId) {
      return db.prepare(`SELECT ${bookingFields} ${bookingsWithWindow}
        WHERE b.owner_id = ? ORDER BY w.starts_at DESC, b.code`).all(ownerId);
    },
    reserveLogisticsWindow(ownerId, windowId, plate, now) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = book(ownerId, windowId, plate, now);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    addLogisticsWindow({ bay, date, operation, startsAt, endsAt, capacity }) {
      return db.prepare(`INSERT INTO logistics_windows (bay, date, operation, starts_at, ends_at, capacity)
        SELECT ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM logistics_windows WHERE bay = ? AND starts_at < ? AND ends_at > ?)
        RETURNING id`).get(bay, date, operation, startsAt, endsAt, capacity, bay, endsAt, startsAt);
    },
    listLogisticsWindows(date, operation, now) {
      return db.prepare(`SELECT id, bay, starts_at AS startsAt, ends_at AS endsAt,
        capacity - (SELECT count(*) FROM logistics_bookings WHERE window_id = w.id) AS remaining
        FROM logistics_windows w WHERE date = ? AND operation = ? AND starts_at > ? AND remaining > 0
        ORDER BY starts_at, bay, id`).all(date, operation, now);
    },
  };
}
