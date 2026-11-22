'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiFailure } from './api';
import { Field } from './components';
import type { Fields } from './types';
import type { StevedoreRecord } from './stevedore-cases';

export const identityLabels = {
  'not-required': 'No aplica',
  matched: 'Conforme',
  mismatch: 'No conforme',
  missing: 'Evidencia faltante',
};

export function StevedoreReview({ code, busy, setBusy, onReviewed }: {
  code: string;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onReviewed: (record: StevedoreRecord) => void;
}) {
  const [result, setResult] = useState('');
  const [identity, setIdentity] = useState('');
  const [fields, setFields] = useState<Fields>({});
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || stale) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setFields({});
    try {
      const { record } = await api<{ record: StevedoreRecord }>('/stevedores/' + encodeURIComponent(code) + '/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result, identityResult: identity, documentsReviewed: data.has('documents'),
          identityReference: data.get('reference'), reason: data.get('reason'),
        }),
      });
      onReviewed(record);
    } catch (error) {
      setError(error instanceof ApiFailure ? error.message : 'No pudimos guardar la verificación.');
      if (error instanceof ApiFailure) {
        setFields(error.fields);
        if (error.status === 409) setStale(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={review} aria-busy={busy}>
      <h3>Verificación municipal</h3>
      {error && <p className="feedback error" role="alert">{error}</p>}
      <Field name="review-result" label="Resultado de la verificación" error={fields.result}>
        <select id="review-result" required value={result} disabled={busy || stale}
          aria-invalid={Boolean(fields.result)} aria-describedby="review-result-hint"
          onChange={(event) => setResult(event.target.value)}>
          <option value="">Selecciona el resultado</option>
          <option value="verified">Verificar</option>
          <option value="observed">Observar</option>
        </select>
      </Field>
      <Field name="identity-result" label="Resultado del cotejo de identidad" error={fields.identityResult}>
        <select id="identity-result" required value={identity} disabled={busy || stale}
          aria-invalid={Boolean(fields.identityResult)} aria-describedby="identity-result-hint"
          onChange={(event) => setIdentity(event.target.value)}>
          <option value="">Selecciona el resultado</option>
          {Object.entries(identityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      {(identity === 'matched' || identity === 'mismatch') && (
        <Field name="identity-reference" label="Referencia del cotejo" error={fields.identityReference} helper="Ingresa el identificador de la verificación externa.">
          <input id="identity-reference" name="reference" required maxLength={64} readOnly={busy || stale}
            aria-invalid={Boolean(fields.identityReference)} aria-describedby="identity-reference-hint" />
        </Field>
      )}
      {result === 'verified' && <label className="review-check">
        <input type="checkbox" name="documents" required disabled={busy || stale} />
        <span>Revisé los documentos y cumplen los requisitos.</span>
      </label>}
      {result === 'observed' && (
        <Field name="review-reason" label="Motivo de observación" error={fields.reason}>
          <textarea id="review-reason" name="reason" required maxLength={1000} rows={4} readOnly={busy || stale}
            aria-invalid={Boolean(fields.reason)} aria-describedby="review-reason-hint" />
        </Field>
      )}
      <button className="button filled" disabled={busy || stale}>{busy ? 'Guardando…' : 'Guardar verificación'}</button>
    </form>
  );
}
