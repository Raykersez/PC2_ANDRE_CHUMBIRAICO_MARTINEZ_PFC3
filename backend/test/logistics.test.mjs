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
  async function signup(email) {
    const response = await fetch(base + '/session/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Clave sintética EP-03' }),
    });
    assert.equal(response.status, 201);
    return { email, cookie: response.headers.get('set-cookie').split(';')[0] };
  }
  function request(path, actor, body) {
    return fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { ...(actor && { Cookie: actor.cookie }), ...(body && { 'Content-Type': 'application/json' }) },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  const book = (actor, windowId, plate) => request('/logistics/bookings', actor, { windowId, plate });

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

  const first = await signup('transporte1@example.invalid');
  const second = await signup('transporte2@example.invalid');
  const { windows: [window] } = await (await available()).json();
  let winningBooking;
  let holder;
  let other;
  await t.test('CLP-13 · reserva el último cupo una vez y evita placas superpuestas', async () => {
    assert.equal((await book(null, window.id, 'ABC-123')).status, 401);
    assert.equal((await book(first, window.id, 'invalida')).status, 400);
    const attempts = await Promise.all([book(first, window.id, 'abc-123'), book(second, window.id, 'APT-456')]);
    assert.deepEqual(attempts.map((response) => response.status).sort(), [201, 409]);
    const index = attempts.findIndex((response) => response.status === 201);
    holder = [first, second][index];
    other = [second, first][index];
    winningBooking = (await attempts[index].json()).booking;
    assert.deepEqual(winningBooking, {
      code: winningBooking.code, plate: ['ABC123', 'APT456'][index], bay: window.bay, operation: 'load',
      date, startsAt: window.startsAt, endsAt: window.endsAt, enteredAt: null,
    });
    assert.match(winningBooking.code, /^TV-[A-F0-9]{16}$/);
    assert.equal((await attempts[1 - index].json()).error.code, 'WINDOW_UNAVAILABLE');
    assert.deepEqual((await (await available()).json()).windows, []);

    const overlap = store.addLogisticsWindow(data('B-03', '10:30', '11:30'));
    const duplicate = await book(other, overlap.id, winningBooking.plate);
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).error.code, 'PLATE_OVERLAP');
    assert.deepEqual((await (await request('/logistics/bookings', holder)).json()).bookings, [winningBooking]);
    assert.deepEqual((await (await request('/logistics/bookings', other)).json()).bookings, []);
    const started = store.addLogisticsWindow(data('B-04', '09:00', '10:00'));
    assert.equal((await book(other, started.id, 'DEF789')).status, 409);
  });

  const agent = await signup('agente@example.invalid');
  await t.test('CLP-14 · verifica la placa y el horario y registra el ingreso una sola vez', async () => {
    assert.equal(store.grantLogisticsAgent(agent.email), true);
    const route = (step, actor = agent, body = { code: winningBooking.code, plate: winningBooking.plate }) =>
      request('/logistics/access/' + step, actor, body);
    assert.equal((await route('entry', holder)).status, 403);
    assert.equal((await route('check', null)).status, 401);
    const early = await route('check');
    assert.equal(early.status, 409);
    assert.equal((await early.json()).error.code, 'OUTSIDE_WINDOW');
    now = window.startsAt;
    const mismatch = await route('check', agent, { code: winningBooking.code, plate: 'ZZZ-999' });
    assert.equal(mismatch.status, 409);
    assert.equal((await mismatch.json()).error.code, 'PLATE_MISMATCH');
    const checked = await route('check');
    assert.equal(checked.status, 200);
    assert.equal((await checked.json()).booking.enteredAt, null);
    now = window.endsAt;
    assert.equal((await route('entry')).status, 409);
    assert.equal((await (await request('/logistics/bookings', holder)).json()).bookings[0].enteredAt, null);

    now = window.startsAt + 60_000;
    const attempts = await Promise.all([route('entry'), route('entry')]);
    assert.deepEqual(attempts.map((response) => response.status), [200, 200]);
    const entries = await Promise.all(attempts.map((response) => response.json()));
    assert.deepEqual(entries.map(({ repeated }) => repeated).sort(), [false, true]);
    assert.equal(entries[0].booking.bay, window.bay);
    assert.equal(entries[0].booking.enteredAt, now);
    assert.equal(entries[1].booking.enteredAt, now);
    now = window.endsAt + 60_000;
    const retry = await (await route('entry')).json();
    assert.equal(retry.repeated, true);
    assert.equal(retry.booking.enteredAt, window.startsAt + 60_000);
  });
});
