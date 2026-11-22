'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiFailure } from '../api';
import { Field } from '../components';
import type { VehicleBooking } from './booking-summary';

export type WindowOption = { id: number; bay: string; startsAt: number; endsAt: number; remaining: number };
export type WindowQuery = { date: string; operation: string };
type Availability = WindowQuery & { windows: WindowOption[] };

const clock = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const clockRange = (startsAt: number, endsAt: number) => clock.format(startsAt) + '–' + clock.format(endsAt);
const dateLabel = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'UTC' });
export const operationLabels: Record<string, string> = { load: 'Carga', unload: 'Descarga' };

export function VehicleWindows({ authenticated, onConfirmed }: {
  authenticated: boolean;
  onConfirmed: (booking: VehicleBooking) => void;
}) {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [plateError, setPlateError] = useState('');
  const [selected, setSelected] = useState<WindowOption | null>(null);
  const [confirmation, setConfirmation] = useState('');

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const filters = new URLSearchParams({ date: String(fields.get('date')), operation: String(fields.get('operation')) });
    setAvailability(null);
    setSelected(null);
    setConfirmation('');
    setError('');
    setBusy(true);
    try {
      setAvailability(await api<Availability>('/logistics/windows?' + filters));
    } catch (error) {
      setError(error instanceof ApiFailure ? error.message : 'No pudimos consultar las ventanas.');
    } finally {
      setBusy(false);
    }
  }

  async function reserve(event: FormEvent<HTMLFormElement>, windowId: number) {
    event.preventDefault();
    if (busy || !availability) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setPlateError('');
    setConfirmation('');
    try {
      const { booking } = await api<{ booking: VehicleBooking }>('/logistics/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ windowId, plate: data.get('plate') }),
      });
      onConfirmed(booking);
      setSelected(null);
      setConfirmation('Turno confirmado. Código ' + booking.code + '.');
      setAvailability((current) => current && {
        ...current, windows: current.windows
          .map((window) => window.id === windowId ? { ...window, remaining: window.remaining - 1 } : window)
          .filter((window) => window.remaining > 0),
      });
    } catch (error) {
      setError(error instanceof ApiFailure ? error.message : 'No pudimos confirmar el turno. Consulta Mis turnos antes de reintentar.');
      if (error instanceof ApiFailure) {
        setPlateError(error.fields.plate ?? '');
        if (error.status === 409) {
          setSelected(null);
          try {
            const { date, operation } = availability;
            setAvailability(await api<Availability>('/logistics/windows?' + new URLSearchParams({ date, operation })));
          } catch {
            setAvailability(null);
          }
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel main-panel logistics-panel" aria-labelledby="availability-title">
      <h2 id="availability-title">Disponibilidad de bahías</h2>
      <form onSubmit={search} aria-busy={busy}>
        <div className="field-grid">
          <Field name="window-date" label="Fecha">
            <input id="window-date" name="date" type="date" required />
          </Field>
          <Field name="window-operation" label="Tipo de operación">
            <select id="window-operation" name="operation">
              <option value="load">Carga</option>
              <option value="unload">Descarga</option>
            </select>
          </Field>
        </div>
        <button className="button filled" disabled={busy}>{busy ? 'Consultando…' : 'Ver disponibilidad'}</button>
      </form>
      {error && <p className="feedback error logistics-feedback" role="alert">{error}</p>}
      {confirmation && <p className="feedback success logistics-feedback" role="status">{confirmation} <a href="#mis-turnos">Ver Mis turnos</a></p>}
      {availability && (
        <div className="logistics-results" aria-live="polite">
          <h3>{operationLabels[availability.operation]} · {dateLabel.format(new Date(availability.date))}</h3>
          {availability.windows.length === 0 ? (
            <p>No hay ventanas disponibles. Elige otra fecha para consultar nuevos horarios.</p>
          ) : (
            <>
              <p className="secondary">Horarios de Lima.</p>
              {!authenticated && <a className="button outline" href="#mis-turnos">Acceder para reservar</a>}
              <ul className="logistics-list">
                {availability.windows.map((window) => (
                  <li key={window.id}>
                    <strong>Bahía {window.bay}</strong>
                    <span>{clockRange(window.startsAt, window.endsAt)}</span>
                    <span>{window.remaining} {window.remaining === 1 ? 'cupo disponible' : 'cupos disponibles'}</span>
                    {authenticated && <button type="button" className="button tonal" disabled={busy}
                      onClick={() => { setSelected(window); setPlateError(''); setError(''); }}>
                      Elegir bahía {window.bay}
                    </button>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {authenticated && selected && (
        <form key={selected.id} onSubmit={(event) => reserve(event, selected.id)} aria-busy={busy}>
          <h3>Reservar bahía {selected.bay} · {clockRange(selected.startsAt, selected.endsAt)}</h3>
          <Field name="booking-plate" label="Placa del vehículo" error={plateError} helper="Por ejemplo, ABC-123.">
            <input id="booking-plate" name="plate" required maxLength={12} autoComplete="off" readOnly={busy}
              aria-invalid={Boolean(plateError)} aria-describedby="booking-plate-hint" />
          </Field>
          <button className="button filled" disabled={busy}>{busy ? 'Confirmando…' : 'Confirmar turno'}</button>
        </form>
      )}
    </section>
  );
}
