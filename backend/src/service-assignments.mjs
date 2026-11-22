import { randomBytes } from 'node:crypto';
import { limaDate } from './calendar.mjs';

export function serviceAssignmentStore(db, tariffs) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stevedore_service_requests (
      code TEXT PRIMARY KEY,
      requester_id TEXT NOT NULL REFERENCES accounts(id),
      service_code TEXT NOT NULL REFERENCES stevedore_services(code),
      starts_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL CHECK (ends_at > starts_at),
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS stevedore_service_requests_owner ON stevedore_service_requests(requester_id, created_at);
    CREATE TABLE IF NOT EXISTS stevedore_service_assignments (
      request_code TEXT PRIMARY KEY REFERENCES stevedore_service_requests(code),
      case_code TEXT NOT NULL REFERENCES stevedore_cases(code),
      tariff_version_id INTEGER NOT NULL REFERENCES stevedore_tariff_versions(id),
      amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
      unit TEXT NOT NULL,
      coordinator_id TEXT NOT NULL REFERENCES accounts(id),
      assigned_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS stevedore_service_assignments_case ON stevedore_service_assignments(case_code);
  `);

  const requestSelect = `SELECT r.code, r.service_code AS serviceCode, s.name AS serviceName,
    r.starts_at AS startsAt, r.ends_at AS endsAt,
    a.case_code AS caseCode, c.name AS stevedoreName, a.tariff_version_id AS tariffVersion,
    a.amount_cents AS amountCents, a.unit, a.coordinator_id AS coordinatorId, a.assigned_at AS assignedAt
    FROM stevedore_service_requests r JOIN stevedore_services s ON s.code = r.service_code
    LEFT JOIN stevedore_service_assignments a ON a.request_code = r.code
    LEFT JOIN stevedore_cases c ON c.code = a.case_code`;

  function present(row, coordinator = false) {
    const { code, serviceCode, serviceName, startsAt, endsAt, caseCode, stevedoreName, tariffVersion,
      amountCents, unit, coordinatorId, assignedAt } = row;
    return {
      code, serviceCode, serviceName, startsAt, endsAt,
      assignment: caseCode === null ? null : {
        caseCode, stevedoreName, tariffVersion, amountCents, unit, assignedAt,
        ...(coordinator && { coordinatorId }),
      },
    };
  }

  function getRequest(code) {
    return db.prepare(requestSelect + ' WHERE r.code = ?').get(code);
  }

  const enabled = `c.status = 'verified' AND EXISTS (
    SELECT 1 FROM stevedore_credentials x
    WHERE x.case_code = c.code AND x.revoked_at IS NULL AND x.issued_at <= ? AND x.expires_at > ?
  )`;
  const available = `NOT EXISTS (SELECT 1 FROM stevedore_service_assignments a
    JOIN stevedore_service_requests r ON r.code = a.request_code
    WHERE a.case_code = c.code AND r.starts_at < ? AND r.ends_at > ?
  )`;

  function assignmentContext(code, now) {
    const request = getRequest(code);
    if (!request) return { error: 'REQUEST_NOT_FOUND' };
    if (request.caseCode !== null) return { error: 'REQUEST_ASSIGNED' };
    if (request.startsAt <= now) return { error: 'SLOT_STARTED' };

    const rate = tariffs.listStevedoreTariffs(limaDate(now), request.serviceCode)[0]?.rate;
    if (!rate) return { error: 'TARIFF_UNAVAILABLE' };
    return { request, rate };
  }

  function assign(code, caseCode, expectedTariffVersion, coordinatorId, now) {
    const context = assignmentContext(code, now);
    if (context.error) return context;
    const { request, rate } = context;
    if (rate.id !== expectedTariffVersion) return { error: 'TARIFF_CHANGED' };

    const candidate = db.prepare(`SELECT (${available}) AS available FROM stevedore_cases c
      WHERE c.code = ? AND ${enabled}`).get(request.endsAt, request.startsAt, caseCode, now, now);
    if (!candidate) return { error: 'STEVEDORE_NOT_ELIGIBLE' };
    if (!candidate.available) return { error: 'SLOT_OVERLAP' };

    db.prepare(`INSERT INTO stevedore_service_assignments
      (request_code, case_code, tariff_version_id, amount_cents, unit, coordinator_id, assigned_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(code, caseCode, rate.id, rate.cents, rate.unit, coordinatorId, now);
    return { request: present(getRequest(code), true) };
  }

  return {
    listServiceRequests(accountId, coordinator) {
      return db.prepare(requestSelect + ' WHERE (? = 1 OR r.requester_id = ?) ORDER BY r.created_at DESC, r.code')
        .all(Number(coordinator), accountId).map((row) => present(row, coordinator));
    },
    createServiceRequest(accountId, { serviceCode, startsAt, endsAt }, now) {
      const code = 'SE-' + randomBytes(8).toString('hex').toUpperCase();
      const inserted = db.prepare(`INSERT INTO stevedore_service_requests
        (code, service_code, requester_id, starts_at, ends_at, created_at)
        SELECT ?, code, ?, ?, ?, ? FROM stevedore_services WHERE code = ? RETURNING code`)
        .get(code, accountId, startsAt, endsAt, now, serviceCode);
      if (inserted) return present(getRequest(code));
    },
    serviceAssignmentOptions(code, now) {
      const context = assignmentContext(code, now);
      if (context.error) return context;
      const { request, rate } = context;
      const candidates = db.prepare(`SELECT c.code, c.name FROM stevedore_cases c
        WHERE ${enabled} AND ${available} ORDER BY c.name, c.code`).all(now, now, request.endsAt, request.startsAt);
      return { rate, candidates };
    },
    assignStevedoreService(code, caseCode, expectedTariffVersion, coordinatorId, clock) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = assign(code, caseCode, expectedTariffVersion, coordinatorId, clock());
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
