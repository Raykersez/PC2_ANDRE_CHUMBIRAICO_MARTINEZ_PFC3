'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiFailure } from '../api';
import { Field } from '../components';

export type WindowOption = { id: number; bay: string; startsAt: number; endsAt: number; remaining: number };
export type WindowQuery = { date: string; operation: string };
type Availability = WindowQuery & { windows: WindowOption[] };

const clock = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const clockRange = (startsAt: number, endsAt: number) => clock.format(startsAt) + '–' + clock.format(endsAt);
const dateLabel = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'UTC' });
export const operationLabels: Record<string, string> = { load: 'Carga', unload: 'Descarga' };

export function VehicleWindows() {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const filters = new URLSearchParams({ date: String(fields.get('date')), operation: String(fields.get('operation')) });
    setAvailability(null);
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
      {availability && (
        <div className="logistics-results" aria-live="polite">
          <h3>{operationLabels[availability.operation]} · {dateLabel.format(new Date(availability.date))}</h3>
          {availability.windows.length === 0 ? (
            <p>No hay ventanas disponibles. Elige otra fecha para consultar nuevos horarios.</p>
          ) : (
            <>
              <p className="secondary">Horarios de Lima.</p>
              <ul className="logistics-list">
                {availability.windows.map((window) => (
                  <li key={window.id}>
                    <strong>Bahía {window.bay}</strong>
                    <span>{clockRange(window.startsAt, window.endsAt)}</span>
                    <span>{window.remaining} {window.remaining === 1 ? 'cupo disponible' : 'cupos disponibles'}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
