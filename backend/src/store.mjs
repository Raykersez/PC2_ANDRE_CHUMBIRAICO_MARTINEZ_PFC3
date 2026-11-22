import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const fields = 'code, name, category, status, created_at AS createdAt';

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
  `);

  function findApplication(code, user) {
    const application = db.prepare(`SELECT ${fields} FROM applications WHERE code = ? AND (account_id = ? OR ? = 'staff')`)
      .get(code, user.id, user.role);
    if (!application || application.status === 'pending') return application;
    const decision = db.prepare(`SELECT reason, decided_at AS decidedAt,
      CASE WHEN ? = 'staff' THEN evaluator_id ELSE NULL END AS evaluatorId
      FROM application_decisions WHERE application_code = ?`).get(user.role, code);
    return { ...application, decision };
  }

  return {
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
      return db.prepare('SELECT id, email, role, password_hash FROM accounts WHERE email = ?').get(email);
    },
    promoteStaff(email) {
      return db.prepare("UPDATE accounts SET role = 'staff' WHERE email = ?").run(email).changes > 0;
    },
    createSession(hash, userId, now, expiry) {
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
      db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(hash, userId, expiry);
    },
    getSession(hash, now) {
      return db.prepare(`SELECT a.id, a.email, a.role FROM sessions s JOIN accounts a ON a.id = s.account_id
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
