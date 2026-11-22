import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../src/app.mjs';
import { openStore } from '../src/store.mjs';

test('CLP-11 · asigna servicios con autorización, disponibilidad y tarifa trazable', async (t) => {
  const store = openStore(':memory:');
  let now = Date.parse('2026-11-21T15:00:00Z');
  const server = createApp(store, { now: () => now }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const route = '/stevedore-service-requests';
  function request(path, user, data) {
    return fetch(base + path, {
      method: data ? 'POST' : 'GET',
      headers: { ...(user && { Cookie: user.cookie }), ...(data && { 'Content-Type': 'application/json' }) },
      body: data && JSON.stringify(data),
    });
  }

  async function signup(name, permission) {
    const email = name + '@example.invalid';
    const response = await request('/session/signup', null, { email, password: 'Clave sintética CLP-11' });
    assert.equal(response.status, 201);
    const { user } = await response.json();
    if (permission) assert.equal(store.grantStevedoreRole(email, permission), true);
    return { ...user, cookie: response.headers.get('set-cookie').split(';')[0] };
  }

  const buyer = await signup('comerciante');
  const unrelated = await signup('otra-cuenta');
  const coordinator = await signup('coordinador', 'coordinator');
  const secondCoordinator = await signup('coordinador-2', 'coordinator');
  const controller = await signup('control', 'controller');
  const certifier = await signup('certificador', 'certifier');
  const worker = await signup('estibador');
  const workerCase = store.createStevedoreCase(worker.id, { name: 'Estibador sintético', documentType: 'DNI', document: '90000712' }, []);
  store.reviewStevedoreCase(workerCase.code, certifier.id, {
    result: 'verified', reason: null, identityResult: 'not-required', identityReference: null,
  });
  const expiresAt = Date.parse('2026-11-22T06:00:00Z');
  const credential = store.issueStevedoreCredential(workerCase.code, controller.id, now, expiresAt).record.credential;

  assert.equal(store.addStevedoreService({ code: 'CARGA', name: 'Carga sintética' }), true);
  assert.equal(store.addStevedoreService({ code: 'TRASLADO', name: 'Traslado sintético' }), true);
  const oldRate = store.addStevedoreTariff({ code: 'CARGA', cents: 850, unit: 'tonelada', startsOn: '2026-11-20', endsOn: null });
  const newRate = store.addStevedoreTariff({ code: 'CARGA', cents: 1100, unit: 'tonelada', startsOn: '2026-11-22', endsOn: null });
  const slot = { serviceCode: 'CARGA', start: '2026-11-23T10:00', end: '2026-11-23T11:00' };

  async function register(data = slot) {
    const response = await request(route, buyer, data);
    assert.equal(response.status, 201);
    return (await response.json()).request;
  }

  const options = (record, actor) => request(route + '/' + record.code + '/options', actor);
  const assign = (record, actor, tariffVersion = oldRate.id) => request(route + '/' + record.code + '/assignment', actor, {
    caseCode: workerCase.code, tariffVersion, amountCents: 10,
  });

  assert.equal((await request(route, null)).status, 401);
  assert.equal((await request(route, buyer, { ...slot, start: '2026-02-30T10:00' })).status, 400);
  assert.equal((await request(route, buyer, { ...slot, end: slot.start })).status, 400);
  const first = await register();
  const sameSlot = await register({ ...slot, start: '2026-11-23T10:30' });
  const adjacent = await register({ ...slot, start: '2026-11-23T11:00', end: '2026-11-23T12:00' });
  const freeLater = await register({ ...slot, start: '2026-11-23T13:00', end: '2026-11-23T14:00' });
  const noTariff = await register({ ...slot, serviceCode: 'TRASLADO' });
  assert.equal((await options(first, unrelated)).status, 403);
  assert.equal((await options(first, controller)).status, 403);
  assert.equal((await assign(first, buyer)).status, 403);
  assert.deepEqual((await (await request(route, unrelated)).json()).requests, []);
  const initial = await (await options(first, coordinator)).json();
  assert.equal(initial.rate.id, oldRate.id);
  assert.deepEqual(initial.candidates, [{ code: workerCase.code, name: workerCase.name }]);
  assert.equal((await (await assign(noTariff, coordinator)).json()).error.code, 'TARIFF_UNAVAILABLE');

  const concurrent = await Promise.all([assign(first, coordinator), assign(sameSlot, secondCoordinator)]);
  assert.deepEqual(concurrent.map(({ status }) => status).sort(), [201, 409]);
  const index = concurrent.findIndex(({ status }) => status === 201);
  const { request: assigned } = await concurrent[index].json();
  assert.equal((await concurrent[1 - index].json()).error.code, 'SLOT_OVERLAP');
  assert.equal(assigned.assignment.coordinatorId, [coordinator.id, secondCoordinator.id][index]);
  assert.equal(assigned.assignment.caseCode, workerCase.code);
  assert.equal(assigned.assignment.tariffVersion, oldRate.id);
  assert.equal(assigned.assignment.amountCents, 850);
  assert.equal(assigned.assignment.unit, 'tonelada');
  assert.equal(assigned.assignment.assignedAt, now);
  assert.ok(assigned.startsAt >= Date.parse('2026-11-23T15:00:00Z'));
  assert.equal((await assign(assigned, coordinator)).status, 409);
  assert.deepEqual((await (await options([sameSlot, first][index], coordinator)).json()).candidates, []);

  now = Date.parse('2026-11-22T05:00:00Z');
  const changed = await assign(adjacent, coordinator);
  assert.equal(changed.status, 409);
  assert.equal((await changed.json()).error.code, 'TARIFF_CHANGED');
  assert.equal((await assign(adjacent, coordinator, newRate.id)).status, 201);
  const history = (await (await request(route, buyer)).json()).requests;
  const historic = history.find(({ code }) => code === assigned.code).assignment;
  assert.equal(historic.tariffVersion, oldRate.id);
  assert.equal(historic.amountCents, 850);
  assert.equal(historic.coordinatorId, undefined);

  assert.ok((await (await options(freeLater, coordinator)).json()).candidates.length);
  store.revokeStevedoreCredential(credential.token, controller.id, now);
  const disabled = await assign(freeLater, coordinator, newRate.id);
  assert.equal(disabled.status, 409);
  assert.equal((await disabled.json()).error.code, 'STEVEDORE_NOT_ELIGIBLE');
  store.issueStevedoreCredential(workerCase.code, controller.id, now, expiresAt);
  now = expiresAt;
  assert.equal((await (await assign(freeLater, coordinator, newRate.id)).json()).error.code, 'STEVEDORE_NOT_ELIGIBLE');
});
