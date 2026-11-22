'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiFailure } from './api';
import { Field } from './components';
import type { Fields, Stall } from './types';

type Operation = { id: string; date: string; product: string; quantity: number; unit: string };
type History = { stall: Stall | null; operations: Operation[]; units: { value: string; label: string }[] };

const dateFormat = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'UTC' });
const quantityFormat = new Intl.NumberFormat('es-PE', { maximumSignificantDigits: 15 });

export function CommercialOperations() {
  const [history, setHistory] = useState<History | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Fields>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const sending = useRef(false);
  const lastSubmission = useRef<{ content: string; id: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void api<History>('/operations', { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setHistory(result); })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setHistory(null);
          setError(error instanceof ApiFailure ? error.message : 'No pudimos cargar el historial.');
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [refresh]);

  async function saveOperation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const details = {
      date: data.get('date'),
      product: String(data.get('product') ?? '').trim(),
      quantity: Number(data.get('quantity')),
      unit: data.get('unit'),
    };
    const content = JSON.stringify(details);
    if (lastSubmission.current?.content !== content) lastSubmission.current = { content, id: crypto.randomUUID() };

    sending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    setFields({});
    try {
      const { operation } = await api<{ operation: Operation }>('/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...details, submissionId: lastSubmission.current.id }),
      });
      setHistory((current) => current && {
        ...current,
        operations: [operation, ...current.operations.filter((item) => item.id !== operation.id)]
          .sort((first, second) => second.date.localeCompare(first.date)),
      });
      form.reset();
      lastSubmission.current = null;
      setNotice('La operación se guardó en tu historial.');
    } catch (error) {
      if (error instanceof ApiFailure) {
        setError(error.message);
        setFields(error.fields);
        const invalidField = Object.keys(error.fields)[0];
        if (invalidField) document.getElementById('operation-' + invalidField)?.focus();
      } else {
        setError('No pudimos confirmar el registro. Vuelve a intentarlo con los mismos datos.');
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <section id="operaciones" className="panel main-panel commercial-operations" aria-labelledby="operations-title">
      <h2 id="operations-title">Operaciones comerciales</h2>
      {error && <p className="feedback error" role="alert">{error}</p>}
      {notice && <p className="feedback success" role="status">{notice}</p>}
      {loading && <p className="secondary" role="status">Consultando el historial…</p>}
      {!loading && !history && <button type="button" className="button outline" onClick={() => setRefresh((value) => value + 1)}>Reintentar</button>}
      {!loading && history && !history.stall && (
        <div>
          <p className="secondary">Cuando tengas un puesto asignado, podrás registrar y consultar aquí tus operaciones.</p>
          <button type="button" className="button outline" onClick={() => setRefresh((value) => value + 1)}>Actualizar puesto</button>
        </div>
      )}
      {history?.stall && (
        <>
          <p className="secondary">Puesto {history.stall.code} · {history.stall.location}</p>
          <div className="operation-columns">
            <form onSubmit={saveOperation} noValidate aria-busy={busy}>
              <h3>Registrar operación</h3>
              <Field name="operation-date" label="Fecha" error={fields.date}>
                <input id="operation-date" name="date" type="date" required readOnly={busy}
                  aria-invalid={Boolean(fields.date)} aria-describedby="operation-date-hint" />
              </Field>
              <Field name="operation-product" label="Producto" error={fields.product}>
                <input id="operation-product" name="product" required maxLength={120} readOnly={busy}
                  aria-invalid={Boolean(fields.product)} aria-describedby="operation-product-hint" />
              </Field>
              <div className="field-grid">
                <Field name="operation-quantity" label="Cantidad" error={fields.quantity}>
                  <input id="operation-quantity" name="quantity" type="number" step="any" inputMode="decimal" required readOnly={busy}
                    aria-invalid={Boolean(fields.quantity)} aria-describedby="operation-quantity-hint" />
                </Field>
                <Field name="operation-unit" label="Unidad" error={fields.unit}>
                  <select id="operation-unit" name="unit" required disabled={busy}
                    aria-invalid={Boolean(fields.unit)} aria-describedby="operation-unit-hint">
                    <option value="">Selecciona una unidad</option>
                    {history.units.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
              </div>
              <button className="button filled" disabled={busy}>{busy ? 'Guardando…' : 'Guardar operación'}</button>
            </form>
            <section aria-labelledby="operations-history">
              <h3 id="operations-history">Historial del puesto {history.stall.code}</h3>
              {history.operations.length === 0 ? <p className="secondary">Aún no hay operaciones registradas.</p> : (
                <ul className="operation-list">
                  {history.operations.map((operation) => (
                    <li key={operation.id}>
                      <strong>{operation.product}</strong>
                      <span>{dateFormat.format(new Date(operation.date))} · {quantityFormat.format(operation.quantity)} {operation.unit}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}
