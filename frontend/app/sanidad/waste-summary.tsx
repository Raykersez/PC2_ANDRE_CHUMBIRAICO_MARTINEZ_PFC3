'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiFailure } from '../api';
import { Field } from '../components';
import type { Fields } from '../types';

type Summary = { from: string; to: string; zone: string; count: number; weightKg: number };
const numbers = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 3 });
const date = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'UTC' });

export function WasteSummary() {
  const [zones, setZones] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<Fields>({});
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void api<{ zones: string[] }>('/waste/zones', { signal: controller.signal })
      .then(({ zones }) => { if (!controller.signal.aborted) setZones(zones); })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(failure instanceof ApiFailure ? failure.message : 'No pudimos consultar las zonas.');
      });
    return () => controller.abort();
  }, []);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFields({});
    setError('');
    setSummary(null);
    setLoading(true);
    const values = new FormData(event.currentTarget);
    const filters = new URLSearchParams({
      zone: String(values.get('zone')), from: String(values.get('from')), to: String(values.get('to')),
    });
    try {
      setSummary(await api<Summary>('/waste/summary?' + filters));
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : 'No pudimos generar el resumen.');
      if (failure instanceof ApiFailure) setFields(failure.fields);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="waste-summary-title">
      <h3 id="waste-summary-title">Resumen de acopio por zona</h3>
      <p className="secondary">Las fechas se consultan en horario de Lima e incluyen ambos días.</p>
      <form onSubmit={search} aria-busy={loading}>
        <Field name="summary-zone" label="Zona" error={fields.zone}>
          <select id="summary-zone" name="zone" disabled={loading} aria-describedby="summary-zone-hint">
            <option value="">Todas las zonas</option>
            {zones.map((zone) => <option key={zone}>{zone}</option>)}
          </select>
        </Field>
        <div className="field-grid">
          <Field name="summary-from" label="Desde" error={fields.from}>
            <input id="summary-from" name="from" type="date" required readOnly={loading}
              aria-invalid={Boolean(fields.from)} aria-describedby="summary-from-hint" />
          </Field>
          <Field name="summary-to" label="Hasta" error={fields.to}>
            <input id="summary-to" name="to" type="date" required readOnly={loading}
              aria-invalid={Boolean(fields.to)} aria-describedby="summary-to-hint" />
          </Field>
        </div>
        <button className="button filled" disabled={loading}>{loading ? 'Consultando…' : 'Consultar resumen'}</button>
      </form>
      {error && <p className="feedback error sanitary-feedback" role="alert">{error}</p>}
      {summary && (
        <div className="sanitary-feedback" role="status">
          <strong>{summary.zone || 'Todas las zonas'}</strong>
          <p>{date.format(new Date(summary.from))} – {date.format(new Date(summary.to))}</p>
          <dl className="receipt field-grid">
            <div><dt>Acopio total</dt><dd>{numbers.format(summary.weightKg)} kg</dd></div>
            <div><dt>Registros vigentes</dt><dd>{numbers.format(summary.count)}</dd></div>
          </dl>
        </div>
      )}
    </section>
  );
}
