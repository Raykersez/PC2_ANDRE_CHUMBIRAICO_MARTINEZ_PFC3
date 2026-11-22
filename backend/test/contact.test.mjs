import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { createApp } from '../src/app.mjs';
import { openStore } from '../src/store.mjs';

test('CLP-25 · contacto público con validación y confirmación persistente', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'mercaorden-contact-'));
  const filename = join(folder, 'test.sqlite');
  const store = openStore(filename);
  const server = createApp(store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
    rmSync(folder, { recursive: true });
  });

  const url = 'http://127.0.0.1:' + server.address().port + '/api/contact';
  const submit = (body, headers = {}) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const valid = {
    email: ' COMERCIO@example.invalid ',
    topic: 'access',
    message: ' Necesito ayuda con mi cuenta de prueba. ',
  };

  assert.equal((await submit(valid, { Origin: 'https://example.invalid' })).status, 403);

  const rejected = await submit({ email: 'inválido', topic: 'unknown', message: '     ' });
  assert.equal(rejected.status, 400);
  assert.deepEqual(Object.keys((await rejected.json()).error.fields), ['email', 'topic', 'message']);

  const accepted = await submit(valid);
  assert.equal(accepted.status, 201);
  const { reference } = await accepted.json();
  assert.match(reference, /^MC-[A-F0-9]{16}$/);

  const db = new DatabaseSync(filename, { readOnly: true });
  try {
    const messages = db.prepare('SELECT reference, email, topic, message FROM contact_messages').all();
    assert.deepEqual(messages.map((row) => ({ ...row })), [{
      reference,
      email: 'comercio@example.invalid',
      topic: 'access',
      message: 'Necesito ayuda con mi cuenta de prueba.',
    }]);
  } finally {
    db.close();
  }

  for (let attempt = 0; attempt < 3; attempt++) assert.equal((await submit({})).status, 400);
  assert.equal((await submit(valid)).status, 429);
});
