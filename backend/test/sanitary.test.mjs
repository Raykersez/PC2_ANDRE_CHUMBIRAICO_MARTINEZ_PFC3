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
    return fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(actor && { Cookie: actor.cookie }), ...(body !== undefined && { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
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
  const path = '/sanitary/inspections';
  const stall = { code: 'P-01', location: 'Zona sintética', category: 'Frutas' };
  assert.equal(store.addStall(stall), true);
  let inspection;

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
});
