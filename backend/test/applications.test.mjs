import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../src/app.mjs';
import { openStore } from '../src/store.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVXYAAAAASUVORK5CYII=', 'base64');
const password = 'Clave sintetica CLP-5';
const validFile = () => new File([png], 'prueba.png', { type: 'image/png' });

function form({ document = '90000001', identity = validFile(), support = validFile(), name = 'Comerciante de Prueba' } = {}) {
  const fields = new FormData();
  for (const [key, value] of Object.entries({ name, documentType: 'DNI', document, category: 'Frutas', identity, support })) {
    if (value !== null) fields.set(key, value);
  }
  return fields;
}

test('CLP-5 · registro de solicitudes de empadronamiento', async (t) => {
  const store = openStore(':memory:');
  const server = createApp(store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const submit = (cookie, body) => fetch(base + '/applications', { method: 'POST', headers: { Cookie: cookie }, body });
  const read = (path, cookie) => fetch(base + path, { headers: cookie ? { Cookie: cookie } : {} });

  async function authenticate(action, email, status) {
    const response = await fetch(base + '/session/' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(response.status, status);
    const session = response.headers.get('set-cookie');
    assert.match(session, /HttpOnly/i);
    assert.match(session, /SameSite=Strict/i);
    return session.split(';')[0];
  }

  const owner = await authenticate('signup', 'titular@example.invalid', 201);
  const other = await authenticate('signup', 'tercero@example.invalid', 201);
  const staff = await authenticate('signup', 'personal@example.invalid', 201);
  assert.equal(store.promoteStaff('personal@example.invalid'), true);
  let receipt;

  await t.test('registra código único, estado pendiente y expediente consultable', async () => {
    const response = await submit(owner, form());
    assert.equal(response.status, 201);
    ({ application: receipt } = await response.json());
    assert.match(receipt.code, /^MO-[A-F0-9]{16}$/);
    assert.equal(receipt.status, 'pending');
    const lookup = await read('/applications/' + receipt.code, owner);
    assert.equal(lookup.status, 200);
    assert.deepEqual((await lookup.json()).application, receipt);
    assert.deepEqual((await (await read('/applications', owner)).json()).applications, [receipt]);
  });

  await t.test('normaliza el documento y conserva el expediente original', async () => {
    const response = await submit(owner, form({ document: ' 9000-0001 ', name: 'Nuevo nombre de prueba' }));
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.error.code, 'ACTIVE_APPLICATION');
    assert.match(body.error.message, /código original/);
    assert.deepEqual(body.application, receipt);
    const foreign = await submit(other, form());
    assert.equal(foreign.status, 409);
    assert.equal((await foreign.json()).application, null);
  });

  await t.test('admite un solo expediente cuando dos envíos llegan juntos', async () => {
    const responses = await Promise.all([
      submit(owner, form({ document: '90000002' })),
      submit(owner, form({ document: '9000 0002' })),
    ]);
    assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 409]);
    const [first, second] = await Promise.all(responses.map((response) => response.json()));
    assert.equal(first.application.code, second.application.code);
    assert.notEqual(first.application.code, receipt.code);
  });

  await t.test('protege ambos adjuntos y permite acceso al titular y al personal', async () => {
    for (const kind of ['identity', 'support']) {
      const path = '/applications/' + receipt.code + '/attachments/' + kind;
      for (const cookie of [owner, staff]) {
        const response = await read(path, cookie);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-disposition'), /^attachment/);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
      }
      assert.equal((await read(path, other)).status, 404);
      assert.equal((await read(path)).status, 401);
    }
  });

  await t.test('rechaza archivos ausentes, con formato incorrecto o mayores a 2 MB', async () => {
    const invalid = new File(['texto de prueba'], 'prueba.pdf', { type: 'application/pdf' });
    const oversized = new File([Buffer.alloc(2 * 1024 * 1024 + 1)], 'prueba.png', { type: 'image/png' });
    for (const identity of [null, invalid, oversized]) {
      const response = await submit(owner, form({ document: '90000003', identity }));
      assert.equal(response.status, 400);
      assert.ok((await response.json()).error.fields.identity);
    }
    assert.equal((await submit(owner, form({ document: '90000003' }))).status, 201);
  });

  await t.test('comprueba sesión y rechaza envíos sin el acceso requerido', async () => {
    const session = await authenticate('login', 'titular@example.invalid', 200);
    assert.equal((await fetch(base + '/session', { method: 'DELETE', headers: { Cookie: session } })).status, 204);
    assert.equal((await submit(session, form())).status, 401);
    assert.equal((await submit(staff, form())).status, 403);
    assert.equal((await fetch(base + '/applications', {
      method: 'POST', headers: { Cookie: owner, Origin: 'https://fuera.example.invalid' }, body: form(),
    })).status, 403);
  });
});
