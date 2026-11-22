'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiFailure } from '../api';
import { Field } from '../components';
import type { Fields } from '../types';

type Collection = {
  id: string; pointCode: string; zone: string; weightKg: number; recorderId: string; recordedAt: number;
};
type History = { points: { code: string; zone: string }[]; collections: Collection[] };

const kilograms = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 3 });
const time = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' });
const path = '/waste/collections';

export function WasteCollections({ busy, setBusy }: { busy: boolean; setBusy: (value: boolean) => void }) {
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fields, setFields] = useState<Fields>({});
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const last = useRef<{ content: string; id: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void api<History>(path, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setHistory(result); })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(failure instanceof ApiFailure ? failure.message : 'No pudimos cargar los puntos.');
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = { pointCode: data.get('pointCode'), weightKg: Number(data.get('weightKg')) };
    const content = JSON.stringify(body);
    if (last.current?.content !== content) last.current = { content, id: crypto.randomUUID() };
    setBusy(true);
    setError('');
    setFields({});
    setNotice('');
    try {
      const { collection } = await api<{ collection: Collection }>(path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, submissionId: last.current.id }),
      });
      setHistory((current) => current && {
        ...current, collections: [collection, ...current.collections.filter(({ id }) => id !== collection.id)],
      });
      last.current = null;
      form.reset();
      setNotice('Acopio registrado.');
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : 'No pudimos confirmar el registro. Reintenta con los mismos datos.');
      if (failure instanceof ApiFailure) setFields(failure.fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="waste-title">
      <h3 id="waste-title">Acopio de mermas orgánicas</h3>
      {loading && <p className="secondary" role="status">Consultando puntos e historial…</p>}
      {error && <p className="feedback error" role="alert">{error}</p>}
      {notice && <p className="feedback success" role="status">{notice}</p>}
      {!loading && !history && <button type="button" className="button outline" onClick={() => setRefresh((value) => value + 1)}>Reintentar</button>}
      {history && (
        <>
          {history.points.length === 0 ? <p className="secondary">No hay puntos de acopio activos.</p> : (
            <form onSubmit={save} noValidate aria-busy={busy}>
              <Field name="waste-point" label="Punto de acopio" error={fields.pointCode}>
                <select id="waste-point" name="pointCode" required defaultValue="" disabled={busy}
                  aria-invalid={Boolean(fields.pointCode)} aria-describedby="waste-point-hint">
                  <option value="">Selecciona un punto activo</option>
                  {history.points.map(({ code, zone }) => <option key={code} value={code}>{code} · {zone}</option>)}
                </select>
              </Field>
              <Field name="waste-weight" label="Peso en kilogramos" error={fields.weightKg} helper="Usa hasta tres decimales.">
                <input id="waste-weight" name="weightKg" type="number" required min="0.001" step="0.001" inputMode="decimal"
                  readOnly={busy} aria-invalid={Boolean(fields.weightKg)} aria-describedby="waste-weight-hint" />
              </Field>
              <button className="button filled" disabled={busy}>{busy ? 'Registrando…' : 'Registrar acopio'}</button>
            </form>
          )}
          <h4>Mis registros de acopio</h4>
          {!history.collections.length && <p className="secondary">Todavía no hay registros.</p>}
          <ul className="operation-list">
            {history.collections.map((item) => <li key={item.id}>
              <strong>{kilograms.format(item.weightKg)} kg · {item.pointCode}</strong>
              <span>{item.zone} · {time.format(item.recordedAt)} (Lima)</span>
              <span>Responsable: {item.recorderId}</span>
            </li>)}
          </ul>
        </>
      )}
    </section>
  );
}
