'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiFailure } from '../api';
import { Field } from '../components';
import type { Fields } from '../types';
import { FindingForm, FindingsHistory, type Finding } from './findings';
import { WasteCollections } from './waste-collections';
import { WasteSummary } from './waste-summary';

export type Inspection = {
  id: string; stallCode: string; version: number; inspectorId: string;
  answers: Record<string, string>; result: string; notes: string; inspectedAt: number;
};
type PanelData = {
  checklist: { version: number; criteria: { code: string; label: string }[] };
  stalls: { code: string; location: string }[];
  inspections: Inspection[];
};
type Draft = { submissionId: string; stallCode: string; answers: Record<string, string>; notes: string };
const emptyDraft = (): Draft => ({ submissionId: '', stallCode: '', answers: {}, notes: '' });
export const sanitaryTime = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' });
const inspectionsPath = '/sanitary/inspections';

export function SanitaryWorkspace({ accountId, busy, setBusy }: {
  accountId: string; busy: boolean; setBusy: (value: boolean) => void;
}) {
  const storageKey = 'mercaorden-inspection-' + accountId;
  const [panel, setPanel] = useState<PanelData | null>(null);
  const [canRecordWaste, setCanRecordWaste] = useState(false);
  const [canSummarizeWaste, setCanSummarizeWaste] = useState(false);
  const [findingFor, setFindingFor] = useState<Inspection | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [historyStall, setHistoryStall] = useState('');
  const [fields, setFields] = useState<Fields>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const options = { signal: controller.signal };
      const [{ canInspect, canRecordWaste, canSummarizeWaste }, { findings }] = await Promise.all([
        api<{ canInspect: boolean; canRecordWaste: boolean; canSummarizeWaste: boolean }>('/sanitary', options),
        api<{ findings: Finding[] }>('/sanitary/findings', options),
      ]);
      if (controller.signal.aborted) return;
      setCanRecordWaste(canRecordWaste);
      setCanSummarizeWaste(canSummarizeWaste);
      setFindings(findings);
      if (canInspect) {
        const data = await api<PanelData>(inspectionsPath, { signal: controller.signal });
        if (!controller.signal.aborted) setPanel(data);
      }
    }
    void load().catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(failure instanceof ApiFailure ? failure.message : 'No pudimos cargar el módulo.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) setDraft(JSON.parse(saved) as Draft);
    } catch {
      // El borrador se mantiene en memoria si el almacenamiento de la pestaña no está disponible.
    }
    return () => controller.abort();
  }, [storageKey]);

  function updateDraft(next: Draft) {
    setDraft(next);
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch {
      // El borrador sigue disponible mientras la página permanezca abierta.
    }
  }

  async function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !panel) return;
    const submission = { ...draft, submissionId: draft.submissionId || crypto.randomUUID() };
    updateDraft(submission);
    setBusy(true);
    setFields({});
    setError('');
    setNotice('');
    try {
      const { inspection } = await api<{ inspection: Inspection }>(inspectionsPath, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...submission, version: panel.checklist.version }),
      });
      setPanel((data) => data && {
        ...data, inspections: [inspection, ...data.inspections.filter((item) => item.id !== inspection.id)],
      });
      setHistoryStall(inspection.stallCode);
      updateDraft(emptyDraft());
      setNotice('Inspección registrada en el historial del puesto.');
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : 'No pudimos confirmar el envío. Reintenta con el mismo borrador.');
      if (failure instanceof ApiFailure) setFields(failure.fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 id="form-title">Fiscalización sanitaria</h2>
      {loading && <p className="secondary" role="status">Consultando tus permisos…</p>}
      {error && <p className="feedback error sanitary-feedback" role="alert">{error}</p>}
      {notice && <p className="feedback success sanitary-feedback" role="status">{notice}</p>}
      {panel && (
        <>
          <form noValidate onSubmit={inspect}>
            <h3>Nueva inspección</h3>
            <Field name="inspection-stall" label="Puesto" error={fields.stallCode}>
              <select id="inspection-stall" required value={draft.stallCode} disabled={busy}
                aria-invalid={Boolean(fields.stallCode)} aria-describedby="inspection-stall-hint"
                onChange={(event) => updateDraft({ ...draft, stallCode: event.target.value })}>
                <option value="">Selecciona un puesto</option>
                {panel.stalls.map((stall) => <option key={stall.code} value={stall.code}>{stall.code} · {stall.location}</option>)}
              </select>
            </Field>
            {panel.checklist.criteria.map(({ code, label }) => (
              <Field key={code} name={'criterion-' + code} label={label} error={fields[code]}>
                <select id={'criterion-' + code} required value={draft.answers[code] ?? ''} disabled={busy}
                  aria-invalid={Boolean(fields[code])} aria-describedby={'criterion-' + code + '-hint'}
                  onChange={(event) => updateDraft({ ...draft, answers: { ...draft.answers, [code]: event.target.value } })}>
                  <option value="">Selecciona el resultado</option>
                  <option value="compliant">Conforme</option>
                  <option value="noncompliant">No conforme</option>
                </select>
              </Field>
            ))}
            <Field name="inspection-notes" label="Observaciones (opcional)" error={fields.notes}>
              <textarea id="inspection-notes" rows={3} value={draft.notes} maxLength={1000} readOnly={busy}
                onChange={(event) => updateDraft({ ...draft, notes: event.target.value })} />
            </Field>
            <div className="receipt-actions">
              <button className="button filled" disabled={busy || panel.stalls.length === 0}>{busy ? 'Guardando…' : 'Registrar inspección'}</button>
              <button className="button outline" type="button" disabled={busy} onClick={() => {
                if (window.confirm('¿Descartar este borrador?')) { updateDraft(emptyDraft()); setFields({}); setError(''); }
              }}>Descartar borrador</button>
            </div>
            {panel.stalls.length === 0 && <p className="secondary">Aún no hay puestos registrados en el catálogo.</p>}
          </form>
          <section aria-labelledby="inspection-history">
            <h3 id="inspection-history">Historial de inspecciones</h3>
            <Field name="history-stall" label="Filtrar por puesto">
              <select id="history-stall" value={historyStall} onChange={(event) => setHistoryStall(event.target.value)}>
                <option value="">Todos los puestos</option>
                {panel.stalls.map((stall) => <option key={stall.code} value={stall.code}>{stall.code}</option>)}
              </select>
            </Field>
            <ul className="operation-list">
              {panel.inspections.filter(({ stallCode }) => !historyStall || stallCode === historyStall).map((item) => (
                <li key={item.id}>
                  <strong>Puesto {item.stallCode} · {item.result === 'compliant' ? 'Conforme' : 'No conforme'}</strong>
                  <span>{sanitaryTime.format(item.inspectedAt)} (Lima) · Lista v{item.version}</span>
                  <span>Inspector: {item.inspectorId}</span>
                  {item.notes && <p>{item.notes}</p>}
                  {item.result === 'noncompliant' && <button className="button tonal" type="button" disabled={busy}
                    onClick={() => setFindingFor(item)}>Registrar hallazgo</button>}
                </li>
              ))}
            </ul>
          </section>
          {findingFor && <FindingForm key={findingFor.id} id={findingFor.id} stallCode={findingFor.stallCode}
            criteria={panel.checklist.criteria.filter(({ code }) => findingFor.answers[code] === 'noncompliant')}
            busy={busy} setBusy={setBusy} onCancel={() => setFindingFor(null)} onSaved={(finding) => {
              setFindings((items) => [finding, ...items]);
              setFindingFor(null);
              setNotice('Hallazgo abierto y disponible para el titular del puesto.');
            }} />}
        </>
      )}
      {!loading && (panel || findings.length > 0 || (!canRecordWaste && !canSummarizeWaste)) && <FindingsHistory findings={findings} canInspect={Boolean(panel)} onChange={(finding) => {
        setFindings((items) => items.map((item) => item.id === finding.id ? finding : item));
      }} />}
      {canRecordWaste && <WasteCollections busy={busy} setBusy={setBusy} />}
      {canSummarizeWaste && <WasteSummary />}
    </>
  );
}
