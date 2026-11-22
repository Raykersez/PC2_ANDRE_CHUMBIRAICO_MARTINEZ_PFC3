'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiFailure } from '../api';
import { Field } from '../components';
import type { Fields } from '../types';
import type { Finding } from './findings';

type Followup = { id: string; result: string; detail: string; inspectorId?: string; reviewedAt: number };
type History = { finding: Finding; followups: Followup[] };
const lima = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' });

export function FindingFollowups({ id, canInspect, onChange }: { id: string; canInspect: boolean; onChange: (finding: Finding) => void }) {
  const url = '/sanitary/findings/' + encodeURIComponent(id) + '/followups';
  const submission = useRef('');
  const [history, setHistory] = useState<History | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<Fields>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void api<History>(url, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setHistory(result); })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(failure instanceof ApiFailure ? failure.message : 'No pudimos consultar el historial.');
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [url, refresh]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    submission.current ||= crypto.randomUUID();
    setBusy(true);
    setFields({});
    setError('');
    setNotice('');
    try {
      const { finding, followup } = await api<{ finding: Finding; followup: Followup }>(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, submissionId: submission.current }),
      });
      setHistory((current) => current && { finding, followups: [...current.followups.filter(({ id }) => id !== followup.id), followup] });
      onChange(finding);
      form.reset();
      submission.current = '';
      setNotice(finding.status === 'closed' ? 'Hallazgo cerrado.' : 'Seguimiento guardado. El hallazgo permanece abierto.');
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : 'No pudimos confirmar la reinspección.');
      if (failure instanceof ApiFailure) setFields(failure.fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sanitary-followups">
      <h4>Reinspecciones</h4>
      {loading && <p role="status">Cargando seguimiento…</p>}
      {error && <p className="feedback error" role="alert">{error}</p>}
      {notice && <p className="feedback success" role="status">{notice}</p>}
      {!loading && error && <button type="button" className="button outline" disabled={busy}
        onClick={() => setRefresh((value) => value + 1)}>Actualizar historial</button>}
      {history && <>
        {!history.followups.length && <p className="secondary">Aún no hay reinspecciones.</p>}
        <ol className="operation-list">
          {history.followups.map((followup) => <li key={followup.id}>
            <strong>{followup.result === 'compliant' ? 'Conforme' : 'No conforme'}</strong>
            <span>{lima.format(followup.reviewedAt)} (Lima)</span>
            {followup.inspectorId && <span>Inspector: {followup.inspectorId}</span>}
            <p>{followup.detail}</p>
          </li>)}
        </ol>
        {canInspect && history.finding.status === 'open' && (
          <form onSubmit={save}>
            <Field name="followup-result" label="Resultado de la reinspección" error={fields.result}>
              <select id="followup-result" name="result" required defaultValue="" disabled={busy}
                aria-invalid={Boolean(fields.result)} aria-describedby="followup-result-hint">
                <option value="">Selecciona un resultado</option>
                <option value="compliant">Conforme · cerrar hallazgo</option>
                <option value="noncompliant">No conforme · mantener abierto</option>
              </select>
            </Field>
            <Field name="followup-detail" label="Evidencia de corrección o motivo de seguimiento" error={fields.detail}>
              <textarea id="followup-detail" name="detail" rows={3} required maxLength={1000} readOnly={busy}
                aria-invalid={Boolean(fields.detail)} aria-describedby="followup-detail-hint" />
            </Field>
            <button className="button filled" disabled={busy}>{busy ? 'Guardando…' : 'Registrar reinspección'}</button>
          </form>
        )}
      </>}
    </div>
  );
}
