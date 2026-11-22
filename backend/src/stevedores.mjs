import { randomBytes } from 'node:crypto';

const fields = 'code, name, status, created_at AS createdAt';

export function stevedoreStore(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stevedore_cases (
      code TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES accounts(id),
      name TEXT NOT NULL,
      document_type TEXT NOT NULL,
      document_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'observed')),
      created_at TEXT NOT NULL,
      UNIQUE(document_type, document_number)
    );
    CREATE INDEX IF NOT EXISTS stevedore_cases_owner ON stevedore_cases(owner_id, created_at);
    CREATE TABLE IF NOT EXISTS stevedore_attachments (
      case_code TEXT NOT NULL REFERENCES stevedore_cases(code),
      kind TEXT NOT NULL,
      mime TEXT NOT NULL,
      bytes BLOB NOT NULL,
      PRIMARY KEY (case_code, kind)
    );
    CREATE TABLE IF NOT EXISTS stevedore_roles (
      account_id TEXT NOT NULL REFERENCES accounts(id),
      role TEXT NOT NULL,
      PRIMARY KEY (account_id, role)
    );
    CREATE TABLE IF NOT EXISTS stevedore_reviews (
      case_code TEXT PRIMARY KEY REFERENCES stevedore_cases(code),
      reviewer_id TEXT NOT NULL REFERENCES accounts(id),
      result TEXT NOT NULL CHECK (result IN ('verified', 'observed')),
      reason TEXT,
      identity_result TEXT NOT NULL,
      identity_reference TEXT,
      reviewed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stevedore_credentials (
      token TEXT PRIMARY KEY,
      case_code TEXT NOT NULL REFERENCES stevedore_cases(code),
      issued_by TEXT NOT NULL REFERENCES accounts(id),
      issued_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER,
      revoked_by TEXT REFERENCES accounts(id)
    );
    CREATE INDEX IF NOT EXISTS stevedore_credentials_case ON stevedore_credentials(case_code, issued_at DESC);
  `);

  function hasStevedoreRole(accountId, role) {
    return Boolean(db.prepare('SELECT 1 FROM stevedore_roles WHERE account_id = ? AND role = ?').get(accountId, role));
  }

  function findStevedoreCase(code, ownerId, canVerify = false) {
    const record = db.prepare(`SELECT ${fields} FROM stevedore_cases WHERE code = ? AND (owner_id = ? OR ? = 1)`)
      .get(code, ownerId, Number(canVerify));
    if (!record || record.status === 'pending') return record;
    const review = db.prepare(`SELECT reason, reviewed_at AS reviewedAt FROM stevedore_reviews WHERE case_code = ?`).get(code);
    if (!canVerify || !review) return { ...record, review };
    const audit = db.prepare(`SELECT reviewer_id AS reviewerId, result, identity_result AS identityResult,
      identity_reference AS identityReference FROM stevedore_reviews WHERE case_code = ?`).get(code);
    return { ...record, review: { ...review, ...audit } };
  }

  const credentialFields = 'token, issued_at AS issuedAt, expires_at AS expiresAt, revoked_at AS revokedAt';

  function findCredential(token) {
    return db.prepare(`SELECT ${credentialFields} FROM stevedore_credentials WHERE token = ?`).get(token);
  }

  function credentialCase(code) {
    const record = db.prepare('SELECT code, status FROM stevedore_cases WHERE code = ?').get(code);
    if (!record) return;
    const credential = db.prepare(`SELECT ${credentialFields} FROM stevedore_credentials
      WHERE case_code = ? ORDER BY issued_at DESC, rowid DESC LIMIT 1`).get(code);
    return { ...record, credential: credential ?? null };
  }

  return {
    credentialCase,
    findCredential,
    issueStevedoreCredential(code, controllerId, now, expiresAt) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const record = credentialCase(code);
        let result = { error: 'NOT_FOUND' };
        if (record) {
          if (record.status !== 'verified') {
            result = { error: 'NOT_VERIFIED' };
          } else if (record.credential && record.credential.revokedAt === null && record.credential.expiresAt > now) {
            result = { error: 'CREDENTIAL_ACTIVE' };
          } else {
            const token = randomBytes(24).toString('hex');
            db.prepare(`INSERT INTO stevedore_credentials (token, case_code, issued_by, issued_at, expires_at)
              VALUES (?, ?, ?, ?, ?)`).run(token, code, controllerId, now, expiresAt);
            result = { record: credentialCase(code) };
          }
        }
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    revokeStevedoreCredential(token, controllerId, now) {
      db.prepare('UPDATE stevedore_credentials SET revoked_at = ?, revoked_by = ? WHERE token = ? AND revoked_at IS NULL AND expires_at > ?')
        .run(now, controllerId, token, now);
      return findCredential(token);
    },
    hasStevedoreRole,
    grantStevedoreRole(email, role) {
      const account = db.prepare('SELECT id FROM accounts WHERE email = ?').get(email);
      if (!account) return false;
      db.prepare('INSERT INTO stevedore_roles VALUES (?, ?) ON CONFLICT DO NOTHING').run(account.id, role);
      return true;
    },
    listStevedoreCases(ownerId) {
      return db.prepare(`SELECT ${fields} FROM stevedore_cases WHERE owner_id = ? ORDER BY created_at DESC`).all(ownerId);
    },
    findStevedoreCase,
    findStevedoreAttachment(code, kind, ownerId, canVerify = false) {
      return db.prepare(`SELECT f.mime, f.bytes FROM stevedore_attachments f
        JOIN stevedore_cases c ON c.code = f.case_code
        WHERE c.code = ? AND f.kind = ? AND (c.owner_id = ? OR ? = 1)`).get(code, kind, ownerId, Number(canVerify));
    },
    reviewStevedoreCase(code, reviewerId, { result, reason, identityResult, identityReference }) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const current = db.prepare('SELECT status FROM stevedore_cases WHERE code = ?').get(code);
        if (current?.status === 'pending') {
          db.prepare('UPDATE stevedore_cases SET status = ? WHERE code = ?').run(result, code);
          db.prepare(`INSERT INTO stevedore_reviews
            (case_code, reviewer_id, result, reason, identity_result, identity_reference, reviewed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .run(code, reviewerId, result, reason, identityResult, identityReference, new Date().toISOString());
        }
        const record = findStevedoreCase(code, reviewerId, true);
        db.exec('COMMIT');
        return { record, recorded: current?.status === 'pending' };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    createStevedoreCase(ownerId, { name, documentType, document }, attachments) {
      const code = 'ES-' + randomBytes(8).toString('hex').toUpperCase();
      db.exec('BEGIN IMMEDIATE');
      try {
        const record = db.prepare(`INSERT INTO stevedore_cases (code, owner_id, name, document_type, document_number, created_at)
          VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(document_type, document_number) DO NOTHING RETURNING ${fields}`)
          .get(code, ownerId, name, documentType, document, new Date().toISOString());
        if (record) {
          const insert = db.prepare('INSERT INTO stevedore_attachments VALUES (?, ?, ?, ?)');
          for (const file of attachments) insert.run(code, file.kind, file.mime, file.bytes);
        }
        db.exec('COMMIT');
        return record;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
