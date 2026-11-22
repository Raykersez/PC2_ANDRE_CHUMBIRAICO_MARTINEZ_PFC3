import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../src/app.mjs';
import { openStore } from '../src/store.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVXYAAAAASUVORK5CYII=', 'base64');
const image = () => new File([png], 'sintetico.png', { type: 'image/png' });

test('CLP-8 · registro y consulta privada de expedientes de estibador', async (t) => {
  const store = openStore(':memory:');
  const server = createApp(store).listen(0, '127.0.0.1');
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
});
