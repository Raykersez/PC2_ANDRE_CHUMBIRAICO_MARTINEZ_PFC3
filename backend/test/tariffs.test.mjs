import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../src/app.mjs';
import { openStore } from '../src/store.mjs';
import { parseTariffCommand } from '../src/tariffs.mjs';

test('CLP-20 · publica la versión vigente al cambiar de fecha en Lima', async (t) => {
  const store = openStore(':memory:');
  let now = Date.parse('2026-11-22T04:59:59Z');
  const server = createApp(store, { now: () => now }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });

  const load = {
    code: 'CARGA', name: 'Carga sintética',
  };
  assert.equal(store.addStevedoreService(load), true);
  assert.equal(store.addStevedoreService(load), false);
  assert.equal(store.addStevedoreService({ code: 'TRASLADO', name: 'Traslado sintético' }), true);
  const firstRate = parseTariffCommand('--tarifa', ['CARGA', '850', 'tonelada', '2026-11-20']);
  const secondRate = parseTariffCommand('--tarifa', ['CARGA', '1050', 'tonelada', '2026-11-22', '2026-11-23']);
  assert.equal(parseTariffCommand('--tarifa', ['CARGA', '-1', 'tonelada', '2026-11-20']), undefined);
  assert.equal(parseTariffCommand('--tarifa', ['CARGA', '10', 'tonelada', '2026-02-30']), undefined);
  assert.equal(parseTariffCommand('--tarifa', ['CARGA', '10', 'tonelada', '2026-11-20', '2026-11-20']), undefined);
  const first = store.addStevedoreTariff(firstRate);
  const second = store.addStevedoreTariff(secondRate);
  assert.notEqual(first.id, second.id);
  assert.equal(store.addStevedoreTariff({ ...secondRate, cents: 2000 }), undefined);
  assert.equal(store.addStevedoreTariff({ ...firstRate, code: 'DESCONOCIDO' }), undefined);

  async function tariff() {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/stevedore-tariffs');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return response.json();
  }

  const before = await tariff();
  assert.equal(before.asOf, '2026-11-21');
  assert.deepEqual(before.services[0], {
    ...load, rate: { id: first.id, cents: 850, unit: 'tonelada', startsOn: '2026-11-20', endsOn: null },
  });
  assert.equal(before.services[1].rate, null);

  now += 1000;
  const after = await tariff();
  assert.equal(after.asOf, '2026-11-22');
  assert.deepEqual(after.services[0], {
    ...load, rate: { id: second.id, cents: 1050, unit: 'tonelada', startsOn: '2026-11-22', endsOn: '2026-11-23' },
  });
  assert.equal(store.listStevedoreTariffs('2026-11-21')[0].rate.id, first.id);

  now = Date.parse('2026-11-23T05:00:00Z');
  const expired = await tariff();
  assert.equal(expired.asOf, '2026-11-23');
  assert.equal(expired.services[0].rate, null);
});
