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
  `);

  return {
    listStevedoreCases(ownerId) {
      return db.prepare(`SELECT ${fields} FROM stevedore_cases WHERE owner_id = ? ORDER BY created_at DESC`).all(ownerId);
    },
    findStevedoreCase(code, ownerId) {
      return db.prepare(`SELECT ${fields} FROM stevedore_cases WHERE code = ? AND owner_id = ?`).get(code, ownerId);
    },
    findStevedoreAttachment(code, kind, ownerId) {
      return db.prepare(`SELECT f.mime, f.bytes FROM stevedore_attachments f
        JOIN stevedore_cases c ON c.code = f.case_code
        WHERE c.code = ? AND f.kind = ? AND c.owner_id = ?`).get(code, kind, ownerId);
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
