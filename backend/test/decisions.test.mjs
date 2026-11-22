import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../src/app.mjs';
import { openStore } from '../src/store.mjs';

test('CLP-6 · decisiones de empadronamiento', async (t) => {
  const store = openStore(':memory:');
  const server = createApp(store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });

  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const json = { 'Content-Type': 'application/json' };
  async function account(email, evaluator = false) {
    const response = await fetch(base + '/session/signup', {
      method: 'POST', headers: json,
      body: JSON.stringify({ email, password: 'Contraseña sintética CLP-6' }),
    });
    assert.equal(response.status, 201);
    const { user } = await response.json();
    if (evaluator) assert.equal(store.promoteStaff(email), true);
    return { id: user.id, cookie: response.headers.get('set-cookie').split(';')[0] };
  }

  const owner = await account('titular@example.invalid');
  const evaluator = await account('evaluador@example.invalid', true);
  const secondEvaluator = await account('evaluador2@example.invalid', true);
  const stranger = await account('otra-cuenta@example.invalid');
  function seed(document) {
    return store.createApplication(owner.id, {
      name: 'Comerciante sintético', category: 'Frutas', documentType: 'DNI', document,
    }, []).application;
  }

  const decide = (code, actor, body) => fetch(base + '/applications/' + code + '/decision', {
    method: 'POST', headers: { ...json, Cookie: actor.cookie }, body: JSON.stringify(body),
  });
  const read = (code, actor) => fetch(base + '/applications/' + code, { headers: { Cookie: actor.cookie } });

  const { code } = seed('90000011');
  const approval = { decision: 'approved', reviewed: true };
  const observation = { decision: 'observed', reason: 'Adjunta el sustento comercial faltante.' };
  assert.equal((await decide(code, owner, approval)).status, 403);
  assert.equal((await decide(code, evaluator, { decision: 'approved' })).status, 400);
  assert.equal((await decide(code, evaluator, { decision: 'observed', reason: '   ' })).status, 400);
  assert.equal((await decide(code, evaluator, { decision: 'pending' })).status, 400);
  assert.equal((await decide('MO-0000000000000000', evaluator, approval)).status, 404);

  const approved = await decide(code, evaluator, approval);
  assert.equal(approved.status, 200);
  const { application: original } = await approved.json();
  assert.equal(original.status, 'approved');
  assert.equal(original.decision.evaluatorId, evaluator.id);
  assert.equal(original.decision.reason, null);
  assert.ok(Number.isFinite(Date.parse(original.decision.decidedAt)));

  const duplicate = await decide(code, secondEvaluator, observation);
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error.code, 'ALREADY_RESOLVED');
  assert.deepEqual((await (await read(code, evaluator)).json()).application, original);

  const observed = seed('90000012');
  const concurrent = await Promise.all([decide(observed.code, evaluator, observation), decide(observed.code, secondEvaluator, observation)]);
  assert.deepEqual(concurrent.map(({ status }) => status).sort(), [200, 409]);
  const winner = concurrent.find((response) => response.status === 200);
  const { application: decision } = await winner.json();
  assert.deepEqual((await (await read(observed.code, evaluator)).json()).application, decision);

  const ownerView = (await (await read(observed.code, owner)).json()).application;
  assert.equal(ownerView.status, 'observed');
  assert.deepEqual(ownerView.decision, { reason: observation.reason, decidedAt: decision.decision.decidedAt, evaluatorId: null });
  assert.equal((await read(observed.code, stranger)).status, 404);
});
