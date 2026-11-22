import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../src/app.mjs';
import { openStore } from '../src/store.mjs';

test('CLP-19 · registra y consulta operaciones del propio puesto sin duplicar reenvíos', async (t) => {
  const store = openStore(':memory:');
  const server = createApp(store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });

  const base = 'http://127.0.0.1:' + server.address().port + '/api/operations';
  async function signup(email) {
    const response = await fetch(base.replace('/operations', '/session/signup'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Contraseña sintética CLP-19' }),
    });
    assert.equal(response.status, 201);
    const { user } = await response.json();
    return { ...user, cookie: response.headers.get('set-cookie').split(';')[0] };
  }

  const first = await signup('comerciante1@example.invalid');
  const second = await signup('comerciante2@example.invalid');
  const unassigned = await signup('sinpuesto@example.invalid');
  const evaluator = await signup('evaluador@example.invalid');
  const admin = await signup('administrador@example.invalid');
  assert.equal(store.promoteStaff(evaluator.email), true);
  assert.equal(store.grantMarketAdmin(admin.email), true);

  function assign(actor, document, code) {
    const category = 'Frutas';
    const { application } = store.createApplication(actor.id, {
      name: 'Comerciante sintético', document, documentType: 'DNI', category,
    }, []);
    assert.equal(store.resolveApplication(application.code, { ...evaluator, role: 'staff' }, 'approved', null).resolved, true);
    assert.equal(store.addStall({ code, location: 'Pabellón de prueba', category }), true);
    assert.equal(store.assignStall(application.code, code, admin.id).assignment.code, code);
  }

  assign(first, '90000031', 'P-01');
  assign(second, '90000032', 'P-02');

  const read = (actor, query = '') => fetch(base + query, { headers: actor ? { Cookie: actor.cookie } : {} });
  const save = (actor, body) => fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(actor ? { Cookie: actor.cookie } : {}) },
    body: JSON.stringify(body),
  });
  const entry = { date: '2026-11-21', product: 'Manzanas de prueba', quantity: 12.5, unit: 'kg', submissionId: randomUUID() };

  assert.equal((await read()).status, 401);
  assert.equal((await save(null, entry)).status, 401);
  assert.equal((await read(admin)).status, 403);
  assert.equal((await save(evaluator, entry)).status, 403);
  assert.equal((await save(unassigned, entry)).status, 403);
  assert.equal((await (await read(unassigned)).json()).stall, null);

  for (const [field, value] of [
    ['quantity', 0], ['quantity', -1], ['quantity', null], ['quantity', '12'],
    ['unit', undefined], ['unit', 'libra'], ['date', '2026-02-30'], ['product', '  '],
  ]) {
    const response = await save(first, { ...entry, [field]: value });
    assert.equal(response.status, 400);
    assert.deepEqual(Object.keys((await response.json()).error.fields), [field]);
  }

  const both = await Promise.all([save(first, entry), save(first, entry)]);
  assert.deepEqual(both.map((response) => response.status).sort(), [200, 201]);
  const { operation } = await both[0].json();
  assert.deepEqual((await both[1].json()).operation, operation);
  assert.deepEqual(operation, { id: entry.submissionId, date: entry.date, product: entry.product, quantity: 12.5, unit: 'kg' });
  assert.equal((await save(first, { ...entry, quantity: 20 })).status, 409);

  const own = await (await read(first)).json();
  assert.equal(own.stall.code, 'P-01');
  assert.deepEqual(own.operations, [operation]);
  assert.ok(own.units.some(({ value }) => value === entry.unit));

  const other = await (await read(second, '?stallCode=P-01')).json();
  assert.equal(other.stall.code, 'P-02');
  assert.deepEqual(other.operations, []);
  const scoped = await save(second, { ...entry, stallCode: 'P-01', product: 'Peras de prueba' });
  assert.equal(scoped.status, 201);
  assert.deepEqual((await (await read(first)).json()).operations, [operation]);
  assert.equal((await (await read(second)).json()).operations[0].product, 'Peras de prueba');
});
