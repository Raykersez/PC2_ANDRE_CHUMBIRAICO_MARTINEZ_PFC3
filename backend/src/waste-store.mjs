export const wastePointPattern = /^[A-Z0-9][A-Z0-9-]{0,23}$/;

export function wasteStore(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS waste_points (
      code TEXT PRIMARY KEY,
      zone TEXT NOT NULL,
      active INTEGER NOT NULL CHECK (active IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS waste_collections (
      id TEXT NOT NULL,
      point_code TEXT NOT NULL REFERENCES waste_points(code),
      zone TEXT NOT NULL,
      weight_grams INTEGER NOT NULL CHECK (weight_grams > 0),
      recorder_id TEXT NOT NULL REFERENCES accounts(id),
      recorded_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
      PRIMARY KEY (recorder_id, id)
    );
    CREATE INDEX IF NOT EXISTS waste_collections_recorder ON waste_collections(recorder_id, recorded_at);
  `);

  const columns = `id, point_code AS pointCode, zone, weight_grams AS grams, recorder_id AS recorderId, recorded_at AS recordedAt`;
  const kilograms = ({ grams, ...row }) => ({ ...row, weightKg: grams / 1000 });

  return {
    setWastePoint(code, zone, active) {
      db.prepare(`INSERT INTO waste_points VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE
        SET zone = excluded.zone, active = excluded.active`).run(code, zone, Number(active));
    },
    listWasteCollections(accountId) {
      const points = db.prepare('SELECT code, zone FROM waste_points WHERE active = 1 ORDER BY zone, code').all();
      const collections = db.prepare(`SELECT ${columns} FROM waste_collections
        WHERE recorder_id = ? AND status = 'active' ORDER BY recorded_at DESC, id`).all(accountId).map(kilograms);
      return { points, collections };
    },
    recordWasteCollection(accountId, { submissionId, pointCode, grams }, now) {
      const inserted = db.prepare(`INSERT INTO waste_collections (id, point_code, zone, weight_grams, recorder_id, recorded_at)
        SELECT ?, code, zone, ?, ?, ? FROM waste_points WHERE code = ? AND active = 1
        ON CONFLICT(recorder_id, id) DO NOTHING RETURNING id`).get(submissionId, grams, accountId, now, pointCode);
      const record = db.prepare(`SELECT ${columns} FROM waste_collections WHERE recorder_id = ? AND id = ?`).get(accountId, submissionId);
      if (!record) return { error: 'POINT_UNAVAILABLE' };
      if (record.pointCode !== pointCode || record.grams !== grams) return { error: 'SUBMISSION_CONFLICT' };
      return { collection: kilograms(record), created: Boolean(inserted) };
    },
  };
}
