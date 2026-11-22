import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../src/app.mjs';
import { openStore } from '../src/store.mjs';
import { inspectionAnswers } from '../src/sanitary-checklist.mjs';

const complete = { hygiene: 'compliant', handling: 'compliant', storage: 'compliant' };

test('CLP-15 · la lista es obligatoria y un incumplimiento determina el resultado', () => {
  assert.deepEqual(inspectionAnswers(complete), { answers: complete, result: 'compliant' });
  assert.equal(inspectionAnswers({ ...complete, storage: 'noncompliant' }).result, 'noncompliant');
  assert.deepEqual(Object.keys(inspectionAnswers({ hygiene: 'compliant' }).fields), ['handling', 'storage']);
});

test('EP-04 · fiscalización sanitaria y residuos', async (t) => {
  const store = openStore(':memory:');
  let now = Date.parse('2026-11-21T15:00:00Z');
  const server = createApp(store, { now: () => now }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  function request(path, actor, body) {
    const multipart = body instanceof FormData;
    return fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(actor && { Cookie: actor.cookie }), ...(body !== undefined && !multipart && { 'Content-Type': 'application/json' }) },
      body: body === undefined || multipart ? body : JSON.stringify(body),
    });
  }
  async function account(name, role) {
    const email = name + '@example.invalid';
    const response = await request('/session/signup', null, { email, password: 'Clave sintética EP-04' });
    assert.equal(response.status, 201);
    const { user } = await response.json();
    if (role) assert.equal(store.grantSanitaryRole(email, role), true);
    return { ...user, cookie: response.headers.get('set-cookie').split(';')[0] };
  }
  const inspector = await account('inspector', 'inspector');
  const owner = await account('comerciante');
  const other = await account('otra-cuenta');
  const path = '/sanitary/inspections';
  const stall = { code: 'P-01', location: 'Zona sintética', category: 'Frutas' };
  assert.equal(store.addStall(stall), true);
  let inspection;
  let finding;

  await t.test('CLP-15 · autoriza, valida y guarda una inspección por borrador', async () => {
    const body = {
      stallCode: stall.code, submissionId: randomUUID(), version: 1,
      answers: { ...complete, storage: 'noncompliant' }, notes: 'Observación sintética.',
    };
    assert.equal((await request(path, null, body)).status, 401);
    assert.equal((await request(path, owner, body)).status, 403);
    assert.equal((await request(path, owner)).status, 403);
    const incomplete = await request(path, inspector, { ...body, answers: { hygiene: 'compliant', storage: 'noncompliant' } });
    assert.equal(incomplete.status, 400);
    assert.deepEqual(Object.keys((await incomplete.json()).error.fields), ['handling']);
    const results = await Promise.all([request(path, inspector, body), request(path, inspector, body)]);
    assert.deepEqual(results.map(({ status }) => status).sort(), [200, 201]);
    inspection = (await results[0].json()).inspection;
    assert.deepEqual((await results[1].json()).inspection, inspection);
    assert.equal(inspection.inspectorId, inspector.id);
    assert.equal(inspection.version, 1);
    assert.equal(inspection.result, 'noncompliant');
    assert.equal(inspection.inspectedAt, now);
    assert.equal((await request(path, inspector, { ...body, notes: 'Otro texto.' })).status, 409);
    const history = await (await request(path + '?stallCode=P-01', inspector)).json();
    assert.deepEqual(history.inspections, [inspection]);
    assert.equal(history.checklist.version, 1);
  });

  await t.test('CLP-16 · registra hallazgo y protege la evidencia por puesto', async () => {
    const { application } = store.createApplication(owner.id, { name: 'Comerciante sintético', category: 'Frutas', documentType: 'DNI', document: '90000801' }, []);
    store.resolveApplication(application.code, { ...inspector, role: 'staff' }, 'approved', null);
    assert.ok(store.assignStall(application.code, stall.code, inspector.id).assignment);
    const path = '/sanitary/findings';
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVXYAAAAASUVORK5CYII=', 'base64');
    const form = (overrides = {}) => {
      const data = new FormData();
      const values = {
        inspectionId: inspection.id, criterion: 'storage', description: 'Incumplimiento sintético.',
        correctiveAction: 'Aplicar medida de prueba.', dueOn: '2026-11-21',
        evidence: new File([png], 'evidencia.png', { type: 'image/png' }), ...overrides,
      };
      for (const [key, value] of Object.entries(values)) data.set(key, value);
      return data;
    };
    assert.equal((await request(path, owner, form())).status, 403);
    const early = await request(path, inspector, form({ dueOn: '2026-11-20' }));
    assert.equal(early.status, 400);
    assert.ok((await early.json()).error.fields.dueOn);
    assert.equal((await request(path, inspector, form({ criterion: 'hygiene' }))).status, 400);
    assert.equal((await request(path, inspector, form({ evidence: new File(['texto'], 'falso.png', { type: 'image/png' }) }))).status, 400);
    const result = await request(path, inspector, form());
    assert.equal(result.status, 201);
    finding = (await result.json()).finding;
    assert.equal(finding.status, 'open');
    assert.equal(finding.inspectionId, inspection.id);
    assert.equal(finding.stallCode, stall.code);
    assert.equal(finding.criterion, 'storage');
    assert.deepEqual((await (await request(path, owner)).json()).findings, [finding]);
    assert.deepEqual((await (await request(path, other)).json()).findings, []);
    const evidence = path + '/' + finding.id + '/evidence';
    assert.equal((await request(evidence, null)).status, 401);
    assert.equal((await request(evidence, other)).status, 404);
    for (const actor of [owner, inspector]) {
      const file = await request(evidence, actor);
      assert.equal(file.status, 200);
      assert.match(file.headers.get('content-disposition'), /^attachment/);
      assert.deepEqual(Buffer.from(await file.arrayBuffer()), png);
    }
  });

  await t.test('CLP-23 · conserva seguimientos y cierra una sola vez cuando se corrige', async () => {
    const url = '/sanitary/findings/' + finding.id + '/followups';
    const unresolved = { submissionId: randomUUID(), result: 'noncompliant', detail: 'La condición sigue presente en la prueba.' };
    assert.equal((await request(url, owner, unresolved)).status, 403);
    assert.equal((await request(url, other)).status, 404);
    const stillOpen = await request(url, inspector, unresolved);
    assert.equal(stillOpen.status, 201);
    assert.equal((await stillOpen.json()).finding.status, 'open');
    assert.equal((await request(url, inspector, unresolved)).status, 200);
    const corrected = { submissionId: randomUUID(), result: 'compliant', detail: 'La revisión sintética confirmó la medida correctiva.' };
    assert.equal((await request(url, inspector, { ...corrected, detail: '' })).status, 400);
    now += 86_400_000;
    const attempts = await Promise.all([request(url, inspector, corrected), request(url, inspector, { ...corrected, submissionId: randomUUID() })]);
    assert.deepEqual(attempts.map(({ status }) => status).sort(), [201, 409]);
    const audit = (await (await request(url, inspector)).json()).followups;
    assert.equal(audit.length, 2);
    assert.equal(audit[0].detail, unresolved.detail);
    assert.equal(audit[1].result, 'compliant');
    assert.equal(audit[1].reviewedAt, now);
    assert.equal(audit[1].inspectorId, inspector.id);
    const holder = await (await request(url, owner)).json();
    assert.equal(holder.finding.status, 'closed');
    assert.equal(holder.finding.inspectionId, inspection.id);
    assert.equal(holder.followups[1].inspectorId, undefined);
  });

  await t.test('CLP-17 · valida peso y punto y evita reenvíos duplicados', async () => {
    const recorder = await account('residuos', 'waste-recorder');
    store.setWastePoint('AC-01', 'Descarga Norte', true);
    store.setWastePoint('AC-02', 'Descarga Sur', false);
    const path = '/waste/collections';
    const record = { submissionId: randomUUID(), pointCode: 'AC-01', weightKg: 1.234 };
    assert.equal((await request(path, inspector, record)).status, 403);
    assert.equal((await request(path, recorder, { ...record, pointCode: 'AC-02' })).status, 400);
    for (const invalid of [0, -1, 0.0001, Number.MAX_SAFE_INTEGER, '1.5', null]) {
      const response = await request(path, recorder, { ...record, weightKg: invalid });
      assert.equal(response.status, 400);
      assert.ok((await response.json()).error.fields.weightKg);
    }
    const attempts = await Promise.all([request(path, recorder, record), request(path, recorder, record)]);
    assert.deepEqual(attempts.map(({ status }) => status).sort(), [200, 201]);
    const result = (await attempts[0].json()).collection;
    assert.deepEqual((await attempts[1].json()).collection, result);
    assert.equal(result.weightKg, 1.234);
    assert.equal(result.zone, 'Descarga Norte');
    assert.equal(result.recorderId, recorder.id);
    assert.equal(result.recordedAt, now);
    assert.equal((await request(path, recorder, { ...record, weightKg: 2 })).status, 409);
    const history = await (await request(path, recorder)).json();
    assert.deepEqual(history.collections, [result]);
    assert.deepEqual(history.points.map(({ code }) => code), ['AC-01']);
    const smallest = await request(path, recorder, { ...record, submissionId: randomUUID(), weightKg: 0.001 });
    assert.equal(smallest.status, 201);
  });
});
