import { randomUUID } from 'node:crypto';
import { checklistVersion } from './sanitary-checklist.mjs';

export function sanitaryStore(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sanitary_roles (
      account_id TEXT NOT NULL REFERENCES accounts(id),
      role TEXT NOT NULL,
      PRIMARY KEY (account_id, role)
    );
    CREATE TABLE IF NOT EXISTS sanitary_inspections (
      id TEXT PRIMARY KEY,
      stall_code TEXT NOT NULL REFERENCES stalls(code),
      inspector_id TEXT NOT NULL REFERENCES accounts(id),
      submission_id TEXT NOT NULL,
      checklist_version INTEGER NOT NULL,
      answers TEXT NOT NULL,
      result TEXT NOT NULL CHECK (result IN ('compliant', 'noncompliant')),
      notes TEXT NOT NULL,
      inspected_at INTEGER NOT NULL,
      UNIQUE (inspector_id, submission_id)
    );
    CREATE INDEX IF NOT EXISTS sanitary_inspections_stall ON sanitary_inspections(stall_code, inspected_at);
  `);

  const columns = `i.id, i.stall_code AS stallCode, i.inspector_id AS inspectorId, i.checklist_version AS version,
    i.answers, i.result, i.notes, i.inspected_at AS inspectedAt`;
  const decode = (row) => ({ ...row, answers: JSON.parse(row.answers) });

  return {
    hasSanitaryRole(accountId, role) {
      return Boolean(db.prepare('SELECT 1 FROM sanitary_roles WHERE account_id = ? AND role = ?').get(accountId, role));
    },
    grantSanitaryRole(email, role) {
      const account = db.prepare('SELECT id FROM accounts WHERE email = ?').get(email);
      if (!account) return false;
      db.prepare('INSERT INTO sanitary_roles VALUES (?, ?) ON CONFLICT DO NOTHING').run(account.id, role);
      return true;
    },
    sanitaryStalls() {
      return db.prepare('SELECT code, location FROM stalls ORDER BY code').all();
    },
    listSanitaryInspections(stallCode = null) {
      return db.prepare(`SELECT ${columns} FROM sanitary_inspections i
        WHERE (? IS NULL OR i.stall_code = ?) ORDER BY i.inspected_at DESC, i.id`)
        .all(stallCode, stallCode).map(decode);
    },
    saveSanitaryInspection(accountId, { submissionId, stallCode, answers, notes, result }, clock) {
      const serialized = JSON.stringify(answers);
      const insert = db.prepare(`INSERT INTO sanitary_inspections
        (id, stall_code, inspector_id, submission_id, checklist_version, answers, result, notes, inspected_at)
        SELECT ?, code, ?, ?, ?, ?, ?, ?, ? FROM stalls WHERE code = ?
        ON CONFLICT(inspector_id, submission_id) DO NOTHING RETURNING id`)
        .get(randomUUID(), accountId, submissionId, checklistVersion, serialized, result, notes, clock(), stallCode);
      const inspection = db.prepare(`SELECT ${columns} FROM sanitary_inspections i
        WHERE i.inspector_id = ? AND i.submission_id = ?`).get(accountId, submissionId);
      if (!inspection) return { error: 'STALL_NOT_FOUND' };
      if (inspection.stallCode !== stallCode || inspection.answers !== serialized || inspection.notes !== notes) {
        return { error: 'SUBMISSION_CONFLICT' };
      }
      return { inspection: decode(inspection), created: Boolean(insert) };
    },
  };
}
