import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { logisticsStore } from './logistics-store.mjs';
import { DatabaseSync } from 'node:sqlite';

const fields = 'code, name, category, status, created_at AS createdAt';
const accountRole = "CASE WHEN m.account_id IS NULL THEN a.role ELSE 'market_admin' END AS role";
export const categories = ['Frutas', 'Verduras', 'Tubérculos', 'Abarrotes', 'Otros alimentos'];
export const stallCodePattern = /^[A-Z0-9][A-Z0-9-]{0,23}$/;

export function openStore(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'merchant' CHECK (role IN ('merchant', 'staff'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS market_admins (
      account_id TEXT PRIMARY KEY REFERENCES accounts(id)
    );
    CREATE TABLE IF NOT EXISTS contact_messages (
      reference TEXT PRIMARY KEY, email TEXT NOT NULL, topic TEXT NOT NULL,
      message TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS applications (
      code TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), name TEXT NOT NULL,
      document_type TEXT NOT NULL, document_number TEXT NOT NULL, category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS active_identity
      ON applications(document_type, document_number) WHERE status = 'pending';
    CREATE INDEX IF NOT EXISTS applications_by_owner ON applications(account_id, created_at);
    CREATE TABLE IF NOT EXISTS attachments (
      application_code TEXT NOT NULL REFERENCES applications(code), kind TEXT NOT NULL,
      mime TEXT NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY (application_code, kind)
    );
    CREATE TABLE IF NOT EXISTS application_decisions (
      application_code TEXT PRIMARY KEY REFERENCES applications(code),
      evaluator_id TEXT NOT NULL REFERENCES accounts(id),
      decision TEXT NOT NULL CHECK (decision IN ('approved', 'observed')),
      reason TEXT,
      decided_at TEXT NOT NULL,
      CHECK ((decision = 'approved' AND reason IS NULL) OR
             (decision = 'observed' AND length(coalesce(reason, '')) BETWEEN 1 AND 1000))
    );
    CREATE TABLE IF NOT EXISTS stalls (
      code TEXT PRIMARY KEY, location TEXT NOT NULL, category TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stall_assignments (
      application_code TEXT PRIMARY KEY REFERENCES applications(code),
      stall_code TEXT NOT NULL UNIQUE REFERENCES stalls(code),
      account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id),
      document_type TEXT NOT NULL, document_number TEXT NOT NULL,
      administrator_id TEXT NOT NULL REFERENCES accounts(id),
      assigned_at TEXT NOT NULL,
      UNIQUE(document_type, document_number)
    );
    CREATE TABLE IF NOT EXISTS commercial_operations (
      application_code TEXT NOT NULL REFERENCES stall_assignments(application_code),
      submission_id TEXT NOT NULL,
      date TEXT NOT NULL, product TEXT NOT NULL, quantity REAL NOT NULL CHECK (quantity > 0),
      unit TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (application_code, submission_id)
    );
  `);

  function activeStall(accountId) {
    return db.prepare(`SELECT sa.application_code, sa.stall_code AS code, s.location
      FROM stall_assignments sa JOIN stalls s ON sa.stall_code = s.code
      JOIN applications a ON a.code = sa.application_code
      WHERE sa.account_id = ? AND a.account_id = ? AND a.status = 'approved'`).get(accountId, accountId);
  }

  const operationFields = 'submission_id AS id, date, product, quantity, unit';

  function findAssignment(code) {
    return db.prepare(`SELECT s.code, s.location, sa.assigned_at AS assignedAt
      FROM stall_assignments sa JOIN stalls s ON s.code = sa.stall_code
      WHERE sa.application_code = ?`).get(code);
  }

  function findApplication(code, user) {
    const application = db.prepare(`SELECT ${fields} FROM applications WHERE code = ? AND (account_id = ? OR ? IN ('staff', 'market_admin'))`)
      .get(code, user.id, user.role);
    if (!application || application.status === 'pending') return application;
    const decision = db.prepare(`SELECT reason, decided_at AS decidedAt,
      CASE WHEN ? = 'staff' THEN evaluator_id ELSE NULL END AS evaluatorId
      FROM application_decisions WHERE application_code = ?`).get(user.role, code);
    const canViewAssignment = user.role === 'market_admin' || user.role === 'merchant';
    const assignment = canViewAssignment && application.status === 'approved' ? findAssignment(code) : undefined;
    return { ...application, decision, assignment };
  }

  function assignmentBlocker(application) {
    if (!application) return 'APPLICATION_NOT_FOUND';
    if (application.status !== 'approved') return 'APPROVAL_REQUIRED';
    const assigned = db.prepare(`SELECT 1 FROM stall_assignments
      WHERE account_id = ? OR (document_type = ? AND document_number = ?)`)
      .get(application.account_id, application.document_type, application.document_number);
    if (assigned) return 'MERCHANT_ASSIGNED';
  }

  function readAssignmentCandidate(code) {
    return db.prepare('SELECT status, category, account_id, document_type, document_number FROM applications WHERE code = ?').get(code);
  }

  function writeAssignment(code, stallCode, administratorId) {
    const application = readAssignmentCandidate(code);
    const blocker = assignmentBlocker(application);
    if (blocker) return { error: blocker };
    const stall = db.prepare(`SELECT s.category, sa.stall_code AS occupied
      FROM stalls s LEFT JOIN stall_assignments sa ON sa.stall_code = s.code WHERE s.code = ?`).get(stallCode);
    if (!stall || stall.occupied) return { error: 'STALL_UNAVAILABLE' };
    if (stall.category !== application.category) return { error: 'STALL_INCOMPATIBLE' };
    db.prepare(`INSERT INTO stall_assignments
      (application_code, stall_code, account_id, document_type, document_number, administrator_id, assigned_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(code, stallCode, application.account_id, application.document_type, application.document_number,
        administratorId, new Date().toISOString());
    return { assignment: findAssignment(code) };
  }

  return {
    ...logisticsStore(db),
    listOperations(accountId) {
      const stall = activeStall(accountId);
      if (!stall) return { stall: null, operations: [] };
      const operations = db.prepare(`SELECT ${operationFields} FROM commercial_operations
        WHERE application_code = ? ORDER BY date DESC, created_at DESC, submission_id DESC`).all(stall.application_code);
      return { stall: { code: stall.code, location: stall.location }, operations };
    },
    createOperation(accountId, { submissionId, date, product, quantity, unit }) {
      const stall = activeStall(accountId);
      if (!stall) return { error: 'ACTIVE_STALL_REQUIRED' };
      const inserted = db.prepare(`INSERT INTO commercial_operations
        (application_code, submission_id, date, product, quantity, unit, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(application_code, submission_id) DO NOTHING
        RETURNING ${operationFields}`).get(stall.application_code, submissionId, date, product, quantity, unit, new Date().toISOString());
      const operation = inserted ?? db.prepare(`SELECT ${operationFields} FROM commercial_operations
        WHERE application_code = ? AND submission_id = ?`).get(stall.application_code, submissionId);
      if (operation.date !== date || operation.product !== product || operation.quantity !== quantity || operation.unit !== unit) {
        return { error: 'SUBMISSION_CONFLICT' };
      }
      return { created: Boolean(inserted), operation };
    },
    createContact({ email, topic, message }) {
      const reference = `MC-${randomBytes(8).toString('hex').toUpperCase()}`;
      db.prepare('INSERT INTO contact_messages (reference, email, topic, message, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(reference, email, topic, message, new Date().toISOString());
      return reference;
    },
    createAccount(email, passwordHash) {
      return db.prepare(`INSERT INTO accounts (id, email, password_hash) VALUES (?, ?, ?)
        ON CONFLICT(email) DO NOTHING RETURNING id, email, role`).get(randomUUID(), email, passwordHash);
    },
    findAccount(email) {
      return db.prepare(`SELECT a.id, a.email, ${accountRole}, a.password_hash
        FROM accounts a LEFT JOIN market_admins m ON m.account_id = a.id WHERE a.email = ?`).get(email);
    },
    promoteStaff(email) {
      return db.prepare("UPDATE accounts SET role = 'staff' WHERE email = ?").run(email).changes > 0;
    },
    grantMarketAdmin(email) {
      return Boolean(db.prepare(`INSERT INTO market_admins (account_id)
        SELECT id FROM accounts WHERE email = ? ON CONFLICT DO NOTHING RETURNING account_id`).get(email))
        || Boolean(db.prepare(`SELECT 1 FROM accounts a JOIN market_admins m ON m.account_id = a.id WHERE a.email = ?`).get(email));
    },
    addStall({ code, location, category }) {
      return db.prepare('INSERT INTO stalls (code, location, category) VALUES (?, ?, ?) ON CONFLICT DO NOTHING')
        .run(code, location, category).changes > 0;
    },
    listAvailableStalls(code) {
      const application = readAssignmentCandidate(code);
      const blocker = assignmentBlocker(application);
      if (blocker) return { error: blocker };
      const stalls = db.prepare(`SELECT s.code, s.location FROM stalls s
        WHERE s.category = ? AND NOT EXISTS (SELECT 1 FROM stall_assignments sa WHERE sa.stall_code = s.code)
        ORDER BY s.code`).all(application.category);
      return { stalls };
    },
    assignStall(code, stallCode, administratorId) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = writeAssignment(code, stallCode, administratorId);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    createSession(hash, userId, now, expiry) {
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
      db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(hash, userId, expiry);
    },
    getSession(hash, now) {
      return db.prepare(`SELECT a.id, a.email, ${accountRole} FROM sessions s JOIN accounts a ON a.id = s.account_id
        LEFT JOIN market_admins m ON m.account_id = a.id
        WHERE s.token_hash = ? AND s.expires_at > ?`).get(hash, now);
    },
    deleteSession(hash) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
    },
    listApplications(userId) {
      return db.prepare(`SELECT ${fields} FROM applications WHERE account_id = ? ORDER BY created_at DESC`).all(userId);
    },
    findApplication,
    resolveApplication(code, evaluator, status, reason) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = db.prepare("UPDATE applications SET status = ? WHERE code = ? AND status = 'pending'")
          .run(status, code);
        if (!result.changes) {
          const application = findApplication(code, evaluator);
          db.exec('COMMIT');
          return { application, resolved: false };
        }
        db.prepare(`INSERT INTO application_decisions (application_code, evaluator_id, decision, reason, decided_at)
          VALUES (?, ?, ?, ?, ?)`).run(code, evaluator.id, status, reason, new Date().toISOString());
        const resolved = findApplication(code, evaluator);
        db.exec('COMMIT');
        return { application: resolved, resolved: true };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    findAttachment(code, kind, user) {
      return db.prepare(`SELECT f.mime, f.bytes FROM attachments f JOIN applications a ON a.code = f.application_code
        WHERE a.code = ? AND f.kind = ? AND (a.account_id = ? OR ? = 'staff')`).get(code, kind, user.id, user.role);
    },
    createApplication(userId, data, attachments) {
      const code = `MO-${randomBytes(8).toString('hex').toUpperCase()}`;
      db.exec('BEGIN IMMEDIATE');
      try {
        const existing = db.prepare(`SELECT ${fields}, account_id FROM applications
          WHERE document_type = ? AND document_number = ? AND status = 'pending'`).get(data.documentType, data.document);
        if (existing) {
          db.exec('COMMIT');
          const { account_id: owner, ...application } = existing;
          return { duplicate: true, application: owner === userId ? application : null };
        }
        const application = db.prepare(`INSERT INTO applications
          (code, account_id, name, document_type, document_number, category, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING ${fields}`)
          .get(code, userId, data.name, data.documentType, data.document, data.category, new Date().toISOString());
        const insertAttachment = db.prepare('INSERT INTO attachments VALUES (?, ?, ?, ?)');
        for (const attachment of attachments) insertAttachment.run(code, attachment.kind, attachment.mime, attachment.bytes);
        db.exec('COMMIT');
        return { duplicate: false, application };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close() { db.close(); },
  };
}
