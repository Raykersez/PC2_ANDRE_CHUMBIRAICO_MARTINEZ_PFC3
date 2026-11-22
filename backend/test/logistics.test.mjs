import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../src/app.mjs';
import { openStore } from '../src/store.mjs';
import { parseWindow } from '../src/logistics-time.mjs';

test('EP-03 · turnos de carga y descarga', async (t) => {
  const store = openStore(':memory:');
  let now = Date.parse('2026-11-21T14:00:00Z');
  const server = createApp(store, { now: () => now }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const date = '2026-11-21';
  const available = (day = date, operation = 'load') =>
    fetch(base + '/logistics/windows?' + new URLSearchParams({ date: day, operation }));
  const data = (bay, start, end, operation = 'load', day = date) => parseWindow([bay, day, start, end, operation, '1']);

  await t.test('CLP-12 · filtra por fecha, operación y hora de Lima', async () => {
    assert.equal(parseWindow(['B-01', '2026-02-30', '09:00', '10:00', 'load', '1']), undefined);
    assert.equal(parseWindow(['B-01', date, '25:00', '10:00', 'load', '1']), undefined);
    assert.ok(store.addLogisticsWindow(data('B-01', '08:00', '09:00')));
    assert.ok(store.addLogisticsWindow(data('B-01', '09:00', '10:00')));
    const future = data('B-01', '10:00', '11:00');
    assert.equal(future.startsAt, Date.parse('2026-11-21T15:00:00Z'));
    const row = store.addLogisticsWindow(future);
    assert.equal(store.addLogisticsWindow(data('B-01', '10:30', '11:30', 'unload')), undefined);
    assert.ok(store.addLogisticsWindow(data('B-02', '10:00', '11:00', 'unload')));
    assert.ok(store.addLogisticsWindow(data('B-01', '10:00', '11:00', 'load', '2026-11-22')));
    const today = await available();
    assert.equal(today.status, 200);
    assert.deepEqual((await today.json()).windows, [
      { id: row.id, bay: 'B-01', startsAt: future.startsAt, endsAt: future.endsAt, remaining: 1 },
    ]);
    assert.equal((await (await available(date, 'unload')).json()).windows[0].bay, 'B-02');
    assert.deepEqual((await (await available('2026-11-23')).json()).windows, []);
    assert.equal((await available('2026-02-30')).status, 400);
    assert.equal((await available(date, 'otro')).status, 400);
  });
});
