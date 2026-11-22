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
});
