import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../src/app.mjs';
import { openStore } from '../src/store.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVXYAAAAASUVORK5CYII=', 'base64');
const image = () => new File([png], 'sintetico.png', { type: 'image/png' });

test('CLP-8 · registro y consulta privada de expedientes de estibador', async (t) => {
  const store = openStore(':memory:');
  let now = Date.parse('2026-11-21T12:00:00Z');
  const server = createApp(store, { now: () => now }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });

  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  async function signup(email) {
    const response = await fetch(base + '/session/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Clave sintética EP-02' }),
    });
    assert.equal(response.status, 201);
    const { user } = await response.json();
    return { ...user, cookie: response.headers.get('set-cookie').split(';')[0] };
  }

  function form(document, identity = image()) {
    const body = new FormData();
    for (const [key, value] of Object.entries({ name: 'Estibador sintético', documentType: 'DNI', document, identity, support: image() })) {
      body.set(key, value);
    }
    return body;
  }

  function request(path, actor, init = {}) {
    const headers = new Headers(init.headers);
    if (actor) headers.set('Cookie', actor.cookie);
    return fetch(base + path, { ...init, headers });
  }

  const owner = await signup('estibador@example.invalid');
  const other = await signup('otra-cuenta@example.invalid');
  const submit = (actor, body) => request('/stevedores', actor, { method: 'POST', body });
  assert.equal((await submit(null, form('90000421'))).status, 401);

  for (const invalid of [
    new File(['texto sintético'], 'sintetico.txt', { type: 'text/plain' }),
    new File(['texto sintético'], 'sintetico.pdf', { type: 'application/pdf' }),
    new File([Buffer.alloc(2 * 1024 * 1024 + 1)], 'sintetico.png', { type: 'image/png' }),
  ]) {
    const response = await submit(owner, form('90000421', invalid));
    assert.equal(response.status, 400);
    assert.ok((await response.json()).error.fields.identity);
  }

  const results = await Promise.all([submit(owner, form('90000421')), submit(owner, form('90.000.421'))]);
  assert.deepEqual(results.map((response) => response.status).sort(), [201, 409]);
  const { record } = await results.find((response) => response.status === 201).json();
  assert.match(record.code, /^ES-[A-F0-9]{16}$/);
  assert.equal(record.status, 'pending');

  assert.equal((await submit(other, form('90000421'))).status, 409);
  assert.deepEqual((await (await request('/stevedores', owner)).json()).records, [record]);
  assert.deepEqual((await (await request('/stevedores', other)).json()).records, []);

  const path = '/stevedores/' + record.code;
  assert.equal((await request(path, other)).status, 404);
  for (const kind of ['identity', 'support']) {
    const url = path + '/attachments/' + kind;
    assert.equal((await request(url, null)).status, 401);
    assert.equal((await request(url, other)).status, 404);
    const file = await request(url, owner);
    assert.equal(file.status, 200);
    assert.match(file.headers.get('content-disposition'), /^attachment/);
    assert.equal(file.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), png);
  }

  await t.test('CLP-9 · verificación y auditoría restringidas al certificador', async () => {
    const certifier = await signup('certificador@example.invalid');
    assert.equal(store.grantStevedoreRole(certifier.email, 'certifier'), true);
    assert.equal((await request(path + '/attachments/identity', certifier)).status, 200);
    const review = (url, actor, data) => request(url + '/review', actor, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    const verified = { result: 'verified', documentsReviewed: true, identityResult: 'matched', identityReference: 'COTEJO-SINTETICO-01' };
    assert.equal((await review(path, owner, verified)).status, 403);
    assert.equal((await review(path, certifier, { ...verified, identityReference: '' })).status, 400);
    assert.equal((await review(path, certifier, { ...verified, documentsReviewed: false })).status, 400);
    const response = await review(path, certifier, verified);
    assert.equal(response.status, 200);
    const audit = (await response.json()).record;
    assert.equal(audit.status, 'verified');
    assert.equal(audit.review.result, 'verified');
    assert.equal(audit.review.reviewerId, certifier.id);
    assert.equal(audit.review.identityReference, verified.identityReference);
    assert.ok(Number.isFinite(Date.parse(audit.review.reviewedAt)));
    assert.equal((await review(path, certifier, verified)).status, 409);
    assert.deepEqual((await (await request(path, certifier)).json()).record, audit);
    const ownerView = (await (await request(path, owner)).json()).record;
    assert.deepEqual(ownerView.review, { reason: null, reviewedAt: audit.review.reviewedAt });

    const observed = (await (await submit(owner, form('90000422'))).json()).record;
    const observedPath = '/stevedores/' + observed.code;
    const note = { result: 'observed', identityResult: 'missing', reason: 'Falta evidencia del cotejo.' };
    assert.equal((await review(observedPath, certifier, { ...note, reason: '' })).status, 400);
    assert.equal((await review(observedPath, certifier, note)).status, 200);
    const detail = (await (await request(observedPath, owner)).json()).record;
    assert.equal(detail.status, 'observed');
    assert.equal(detail.review.reason, note.reason);
  });

  await t.test('CLP-10 · emite un QR opaco y valida vencimiento y revocación', async () => {
    const controller = await signup('control@example.invalid');
    assert.equal(store.grantStevedoreRole(controller.email, 'controller'), true);
    const endpoint = path + '/credential';
    const issue = (url, actor) => request(url, actor, { method: 'POST' });
    const records = (await (await request('/stevedores', owner)).json()).records;
    const observed = records.find((item) => item.status === 'observed');
    assert.equal((await issue('/stevedores/' + observed.code + '/credential', controller)).status, 409);
    assert.equal((await issue(endpoint, owner)).status, 403);
    assert.equal((await request(path + '/attachments/identity', controller)).status, 404);
    const attempts = await Promise.all([issue(endpoint, controller), issue(endpoint, controller)]);
    assert.deepEqual(attempts.map((response) => response.status).sort(), [201, 409]);
    const { credential } = (await attempts.find((response) => response.status === 201).json()).record;
    assert.match(credential.token, /^[a-f0-9]{48}$/);
    assert.equal(new URL(credential.validationUrl).pathname, '/estibadores/validar/' + credential.token);
    const url = '/stevedore-credentials/' + credential.token;
    assert.equal((await request(url + '/qr')).status, 401);
    const qr = await request(url + '/qr', controller);
    assert.equal(qr.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await qr.arrayBuffer()).subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.deepEqual(await (await request(url)).json(), { status: 'active', expiresAt: credential.expiresAt });
    assert.equal((await request('/stevedore-credentials/desconocida')).status, 404);

    now = Date.parse(credential.expiresAt);
    assert.equal((await (await request(url)).json()).status, 'expired');
    const replacement = await issue(endpoint, controller);
    assert.equal(replacement.status, 201);
    const next = (await replacement.json()).record.credential;
    assert.notEqual(next.token, credential.token);
    const nextUrl = '/stevedore-credentials/' + next.token;
    assert.equal((await issue(nextUrl + '/revoke', other)).status, 403);
    assert.equal((await (await issue(nextUrl + '/revoke', controller)).json()).status, 'revoked');
    assert.equal((await (await request(nextUrl)).json()).status, 'revoked');
  });
});
