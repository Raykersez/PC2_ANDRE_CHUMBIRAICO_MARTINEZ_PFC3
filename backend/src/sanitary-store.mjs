import { randomUUID } from 'node:crypto';
import { checklistVersion } from './sanitary-checklist.mjs';
import { limaDate } from './calendar.mjs';

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
    CREATE TABLE IF NOT EXISTS sanitary_findings (
      id TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL REFERENCES sanitary_inspections(id),
      inspector_id TEXT NOT NULL REFERENCES accounts(id),
      criterion TEXT NOT NULL,
      description TEXT NOT NULL,
      corrective_action TEXT NOT NULL,
      due_on TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
      created_at INTEGER NOT NULL,
      evidence_mime TEXT,
      evidence_bytes BLOB
    );
    CREATE INDEX IF NOT EXISTS sanitary_findings_inspection ON sanitary_findings(inspection_id);
  `);

  const columns = `i.id, i.stall_code AS stallCode, i.inspector_id AS inspectorId, i.checklist_version AS version,
    i.answers, i.result, i.notes, i.inspected_at AS inspectedAt`;
  const decode = (row) => ({ ...row, answers: JSON.parse(row.answers) });
  const findingSelect = `SELECT f.id, f.inspection_id AS inspectionId, i.stall_code AS stallCode, f.criterion,
    f.description, f.corrective_action AS correctiveAction, f.due_on AS dueOn, f.status,
    f.created_at AS createdAt, (f.evidence_mime IS NOT NULL) AS hasEvidence
    FROM sanitary_findings f JOIN sanitary_inspections i ON f.inspection_id = i.id`;
  const mayReadFinding = `(? = 1 OR EXISTS (SELECT 1 FROM stall_assignments s
    WHERE s.stall_code = i.stall_code AND s.account_id = ?))`;

  return {
    listSanitaryFindings(accountId, inspector) {
      return db.prepare(findingSelect + ' WHERE ' + mayReadFinding + ' ORDER BY f.created_at DESC, f.id')
        .all(Number(inspector), accountId);
    },
    readSanitaryEvidence(id, accountId, inspector) {
      return db.prepare(`SELECT f.evidence_mime AS mime, f.evidence_bytes AS bytes
        FROM sanitary_findings f JOIN sanitary_inspections i ON f.inspection_id = i.id
        WHERE f.id = ? AND f.evidence_mime IS NOT NULL AND ${mayReadFinding}`).get(id, Number(inspector), accountId);
    },
    createSanitaryFinding(inspectorId, { inspectionId, criterion, description, correctiveAction, dueOn, evidence }, clock) {
      const inspection = db.prepare('SELECT answers, inspected_at FROM sanitary_inspections WHERE id = ?').get(inspectionId);
      if (!inspection) return { error: 'INSPECTION_NOT_FOUND' };
      if (JSON.parse(inspection.answers)[criterion] !== 'noncompliant') return { error: 'CRITERION_COMPLIANT' };
      if (dueOn < limaDate(inspection.inspected_at)) return { error: 'DEADLINE_TOO_EARLY' };
      const id = randomUUID();
      db.prepare(`INSERT INTO sanitary_findings
        (id, inspection_id, inspector_id, criterion, description, corrective_action, due_on, created_at, evidence_mime, evidence_bytes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, inspectionId, inspectorId, criterion, description, correctiveAction, dueOn, clock(), evidence?.mime ?? null, evidence?.bytes ?? null);
      return { finding: db.prepare(findingSelect + ' WHERE f.id = ?').get(id) };
    },
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
