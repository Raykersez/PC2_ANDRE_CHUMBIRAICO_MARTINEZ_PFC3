'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiFailure } from '../api';
import { Field } from '../components';
import type { Fields } from '../types';
import { VehicleWindows } from './windows';
import { BookingSummary, type VehicleBooking } from './booking-summary';
import { VehicleAccess } from './access';

type Account = { bookings: VehicleBooking[]; canControlAccess: boolean };

export function VehicleWorkspace() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [fields, setFields] = useState<Fields>({});
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void api<Account>('/logistics/bookings', { signal: controller.signal })
      .then((account) => { if (!controller.signal.aborted) setAccount(account); })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && !(error instanceof ApiFailure && error.status === 401)) {
          setError(error instanceof ApiFailure ? error.message : 'No pudimos consultar tus turnos.');
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  function showError(error: unknown) {
    setError(error instanceof ApiFailure ? error.message : 'No pudimos completar la operación.');
    if (error instanceof ApiFailure) setFields(error.fields);
  }

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setFields({});
    try {
      await api('/session/' + mode, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.get('email'), password: data.get('password') }),
      });
      setAccount(await api<Account>('/logistics/bookings'));
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      await api('/session', { method: 'DELETE' });
      setAccount(null);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  function confirmed(booking: VehicleBooking) {
    setAccount((state) => state && {
      ...state, bookings: [booking, ...state.bookings].sort((first, second) => second.startsAt - first.startsAt),
    });
  }

  return (
    <>
      <VehicleWindows authenticated={Boolean(account)} onConfirmed={confirmed} />
      <section className="panel main-panel logistics-panel" id="mis-turnos" aria-labelledby="bookings-title">
        <h2 id="bookings-title">Mis turnos</h2>
        {error && <p className="feedback error logistics-feedback" role="alert">{error}</p>}
        {loading ? <p className="secondary" role="status">Consultando tu sesión…</p> : account ? (
          <>
            {account.bookings.length ? (
              <ul className="logistics-list">
                {account.bookings.map((booking) => (
                  <li key={booking.code}><BookingSummary booking={booking} /></li>
                ))}
              </ul>
            ) : <p className="secondary">Aún no tienes turnos reservados.</p>}
            <button type="button" className="button outline logistics-signout" disabled={busy} onClick={signOut}>Cerrar sesión</button>
          </>
        ) : (
          <>
            <p className="secondary">Accede a tu cuenta para reservar y consultar tus turnos.</p>
            <div className="segmented" aria-label="Acceso a la cuenta">
              <button type="button" aria-pressed={mode === 'login'} disabled={busy} onClick={() => { setMode('login'); setError(''); setFields({}); }}>Iniciar sesión</button>
              <button type="button" aria-pressed={mode === 'signup'} disabled={busy} onClick={() => { setMode('signup'); setError(''); setFields({}); }}>Crear cuenta</button>
            </div>
            <form key={mode} onSubmit={authenticate}>
              <Field name="vehicle-email" label="Correo electrónico" error={fields.email}>
                <input id="vehicle-email" name="email" type="email" autoComplete="email" required maxLength={254}
                  aria-invalid={Boolean(fields.email)} aria-describedby="vehicle-email-hint" />
              </Field>
              <Field name="vehicle-password" label="Contraseña" error={fields.password} helper={mode === 'signup' ? 'Usa al menos 10 caracteres.' : undefined}>
                <input id="vehicle-password" name="password" type="password" required maxLength={128}
                  minLength={mode === 'signup' ? 10 : undefined} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  aria-invalid={Boolean(fields.password)} aria-describedby="vehicle-password-hint" />
              </Field>
              <button className="button filled" disabled={busy}>{busy ? 'Un momento…' : mode === 'signup' ? 'Crear cuenta' : 'Ingresar'}</button>
            </form>
          </>
        )}
      </section>
      {account?.canControlAccess && <VehicleAccess />}
    </>
  );
}
