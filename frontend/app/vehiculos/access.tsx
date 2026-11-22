'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiFailure } from '../api';
import { Field } from '../components';
import type { Fields } from '../types';
import { BookingSummary, type VehicleBooking } from './booking-summary';

type AccessResult = { booking: VehicleBooking; repeated?: boolean };
const limaTime = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima', dateStyle: 'medium', timeStyle: 'short',
});

export function VehicleAccess() {
  const [selection, setSelection] = useState<AccessResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Fields>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function access(operation: 'check' | 'entry' | 'exit', code: string, plate: string) {
    if (busy) return;
    setBusy(true);
    setFields({});
    setError('');
    setNotice('');
    setSelection(null);
    try {
      const result = await api<AccessResult>('/logistics/access/' + operation, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, plate }),
      });
      setSelection(result);
      if (operation === 'exit') {
        setNotice('Salida registrada. El turno quedó cerrado.');
      } else if (result.booking.exitedAt === null && result.booking.enteredAt !== null) {
        setNotice(result.repeated ? 'El ingreso ya estaba registrado.' : 'Ingreso registrado.');
      }
    } catch (error) {
      if (error instanceof ApiFailure) {
        setError(error.message);
        setFields(error.fields);
      } else {
        setError('No pudimos comprobar el turno. Vuelve a intentarlo.');
      }
    } finally {
      setBusy(false);
    }
  }

  function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void access('check', String(data.get('code')), String(data.get('plate')));
  }

  return (
    <section className="panel main-panel logistics-panel" aria-labelledby="access-title">
      <h2 id="access-title">Control de ingreso y salida</h2>
      <p className="secondary">Compara el código del turno y la placa del vehículo antes de registrar un movimiento.</p>
      <form onSubmit={check} onChange={() => { setSelection(null); setNotice(''); }} aria-busy={busy}>
        <div className="field-grid">
          <Field name="access-code" label="Código del turno" error={fields.code}>
            <input id="access-code" name="code" required maxLength={19} placeholder="TV-…" readOnly={busy} autoComplete="off"
              aria-invalid={Boolean(fields.code)} aria-describedby="access-code-hint" />
          </Field>
          <Field name="access-plate" label="Placa del vehículo" error={fields.plate}>
            <input id="access-plate" name="plate" required maxLength={12} placeholder="ABC-123" readOnly={busy} autoComplete="off"
              aria-invalid={Boolean(fields.plate)} aria-describedby="access-plate-hint" />
          </Field>
        </div>
        <button className="button tonal" disabled={busy}>{busy ? 'Consultando…' : 'Verificar turno'}</button>
      </form>
      {error && <p className="feedback error logistics-feedback" role="alert">{error}</p>}
      {notice && <p className="feedback success logistics-feedback" role="status">{notice}</p>}
      {selection && (
        <div className="logistics-results">
          <div className="access-details"><BookingSummary booking={selection.booking} /></div>
          {selection.booking.enteredAt === null ? (
            <button className="button filled logistics-signout" type="button" disabled={busy}
              onClick={() => access('entry', selection.booking.code, selection.booking.plate)}>Confirmar ingreso</button>
          ) : (
            <>
              <p className="secondary">Ingreso registrado el {limaTime.format(selection.booking.enteredAt)} (Lima).</p>
              {selection.booking.exitedAt === null ? (
                <button className="button filled logistics-signout" type="button" disabled={busy}
                  onClick={() => access('exit', selection.booking.code, selection.booking.plate)}>Confirmar salida</button>
              ) : (
                <p className="secondary">Salida registrada el {limaTime.format(selection.booking.exitedAt)} (Lima).
                  Permanencia de {selection.booking.stayMinutes} {selection.booking.stayMinutes === 1 ? 'minuto' : 'minutos'}.</p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
