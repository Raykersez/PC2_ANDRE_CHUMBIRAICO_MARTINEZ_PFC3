import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../src/app.mjs';
import { openStore } from '../src/store.mjs';

test('CLP-7 · asigna un solo puesto compatible y vigente', async (t) => {
  const store = openStore(':memory:');
  const server = createApp(store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });

  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const password = 'Contraseña sintética CLP-7';
  async function signIn(email, flow) {
    const response = await fetch(base + '/session/' + flow, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(response.status, flow === 'signup' ? 201 : 200);
    const { user } = await response.json();
    return { ...user, cookie: response.headers.get('set-cookie').split(';')[0] };
  }

  const first = await signIn('comerciante1@example.invalid', 'signup');
  const second = await signIn('comerciante2@example.invalid', 'signup');
  const evaluator = await signIn('evaluador@example.invalid', 'signup');
  assert.equal(store.promoteStaff(evaluator.email), true);
  const adminA = await signIn('administrador1@example.invalid', 'signup');
  const adminB = await signIn('administrador2@example.invalid', 'signup');
  assert.equal(store.grantMarketAdmin('ausente@example.invalid'), false);
  assert.equal(store.grantMarketAdmin(adminA.email), true);
  assert.equal(store.grantMarketAdmin(adminA.email), true);
  assert.equal(store.grantMarketAdmin(adminB.email), true);
  assert.equal((await signIn(adminA.email, 'login')).role, 'market_admin');

  function seed(actor, document, status = 'approved') {
    const { application } = store.createApplication(actor.id, {
      name: 'Comerciante sintético', category: 'Frutas', documentType: 'DNI', document,
    }, []);
    if (status === 'approved') store.resolveApplication(application.code, { ...evaluator, role: 'staff' }, 'approved', null);
    return application.code;
  }

  const firstCode = seed(first, '90000021');
  const secondCode = seed(second, '90000022');
  const pendingCode = seed(first, '90000023', 'pending');
  const free = { code: 'P-01', location: 'Pabellón de prueba', category: 'Frutas' };
  assert.equal(store.addStall(free), true);
  assert.equal(store.addStall(free), false);
  assert.equal(store.addStall({ code: 'V-01', location: 'Sector sintético', category: 'Verduras' }), true);

  function request(code, actor, endpoint = '', body) {
    return fetch(base + '/applications/' + code + endpoint, {
      method: body ? 'POST' : 'GET',
      headers: {
        Cookie: actor.cookie,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  const assign = (code, actor, stallCode) => request(code, actor, '/assignment', { stallCode });
  assert.equal((await assign(firstCode, first, free.code)).status, 403);
  assert.equal((await assign(firstCode, evaluator, free.code)).status, 403);
  assert.equal((await request(firstCode, first, '/stalls')).status, 403);
  assert.equal((await request(firstCode, adminA, '/decision', { decision: 'approved', reviewed: true })).status, 403);
  assert.equal((await assign(firstCode, adminA, '')).status, 400);
  assert.equal((await assign(pendingCode, adminA, free.code)).status, 409);
  const incompatible = await assign(firstCode, adminA, 'V-01');
  assert.equal(incompatible.status, 409);
  assert.equal((await incompatible.json()).error.code, 'STALL_INCOMPATIBLE');
  assert.deepEqual((await (await request(firstCode, adminA, '/stalls')).json()).stalls,
    [{ code: free.code, location: free.location }]);

  const responses = await Promise.all([assign(firstCode, adminA, free.code), assign(secondCode, adminB, free.code)]);
  assert.deepEqual(responses.map((result) => result.status).sort(), [201, 409]);
  const winner = responses.findIndex((result) => result.status === 201);
  const winningCode = [firstCode, secondCode][winner];
  const losingCode = [secondCode, firstCode][winner];
  const { assignment } = await responses[winner].json();
  assert.equal(assignment.code, free.code);
  assert.ok(Number.isFinite(Date.parse(assignment.assignedAt)));
  assert.equal((await responses[1 - winner].json()).error.code, 'STALL_UNAVAILABLE');
  assert.deepEqual((await (await request(winningCode, adminA)).json()).application.assignment, assignment);
  assert.deepEqual((await (await request(losingCode, adminB, '/stalls')).json()).stalls, []);

  assert.equal(store.addStall({ ...free, code: 'P-02' }), true);
  const retry = await assign(winningCode, adminB, 'P-02');
  assert.equal(retry.status, 409);
  assert.equal((await retry.json()).error.code, 'MERCHANT_ASSIGNED');
  const repeatIdentity = seed([second, first][winner], ['90000021', '90000022'][winner]);
  const duplicate = await assign(repeatIdentity, adminB, 'P-02');
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error.code, 'MERCHANT_ASSIGNED');
});
