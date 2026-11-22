'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiFailure } from '../api';
import { Field } from '../components';
import type { Fields } from '../types';

export type Finding = {
  id: string; inspectionId: string; stallCode: string; criterion: string;
  description: string; correctiveAction: string; dueOn: string; status: 'open' | 'closed'; hasEvidence: number;
};
type Criterion = { code: string; label: string };
const calendar = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'UTC' });
export const criterionLabels: Record<string, string> = {
  hygiene: 'Higiene del puesto', handling: 'Manipulación de alimentos', storage: 'Almacenamiento',
};
const url = '/sanitary/findings';

export function FindingForm({ id, stallCode, criteria, busy, setBusy, onSaved, onCancel }: {
  id: string; stallCode: string; criteria: Criterion[]; busy: boolean;
  setBusy: (value: boolean) => void; onSaved: (finding: Finding) => void; onCancel: () => void;
}) {
  const [fields, setFields] = useState<Fields>({});
  const [error, setError] = useState('');
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    data.set('inspectionId', id);
    setBusy(true);
    setFields({});
    setError('');
    try {
      const { finding } = await api<{ finding: Finding }>(url, { method: 'POST', body: data });
      onSaved(finding);
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : 'No pudimos guardar el hallazgo.');
      if (failure instanceof ApiFailure) setFields(failure.fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <h3>Nuevo hallazgo del puesto {stallCode}</h3>
      {error && <p className="feedback error" role="alert">{error}</p>}
      <Field name="finding-criterion" label="Criterio no conforme" error={fields.criterion}>
        <select id="finding-criterion" name="criterion" required defaultValue="" disabled={busy}
          aria-invalid={Boolean(fields.criterion)} aria-describedby="finding-criterion-hint">
          <option value="">Selecciona un criterio</option>
          {criteria.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
        </select>
      </Field>
      <Field name="finding-description" label="Incumplimiento" error={fields.description}>
        <textarea id="finding-description" name="description" required maxLength={1000} rows={3} readOnly={busy}
          aria-invalid={Boolean(fields.description)} aria-describedby="finding-description-hint" />
      </Field>
      <Field name="finding-action" label="Acción correctiva" error={fields.correctiveAction}>
        <textarea id="finding-action" name="correctiveAction" required maxLength={1000} rows={3} readOnly={busy}
          aria-invalid={Boolean(fields.correctiveAction)} aria-describedby="finding-action-hint" />
      </Field>
      <Field name="finding-due" label="Fecha límite (Lima)" error={fields.dueOn}>
        <input id="finding-due" name="dueOn" type="date" required readOnly={busy}
          aria-invalid={Boolean(fields.dueOn)} aria-describedby="finding-due-hint" />
      </Field>
      <Field name="finding-evidence" label="Evidencia (opcional)" error={fields.evidence} helper="PDF, JPG o PNG de hasta 2 MB.">
        <input id="finding-evidence" name="evidence" type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={busy}
          aria-invalid={Boolean(fields.evidence)} aria-describedby="finding-evidence-hint" />
      </Field>
      <div className="receipt-actions">
        <button className="button filled" disabled={busy}>{busy ? 'Guardando…' : 'Guardar hallazgo'}</button>
        <button className="button outline" type="button" disabled={busy} onClick={onCancel}>Volver al historial</button>
      </div>
    </form>
  );
}

export function FindingsHistory({ findings }: { findings: Finding[] }) {
  return (
    <section aria-labelledby="findings-history">
      <h3 id="findings-history">Hallazgos sanitarios</h3>
      {!findings.length && <p className="secondary">No hay hallazgos disponibles para tu cuenta.</p>}
      <ul className="operation-list">
        {findings.map((finding) => (
          <li key={finding.id}>
            <strong>Puesto {finding.stallCode} · {criterionLabels[finding.criterion] ?? finding.criterion}</strong>
            <span className="status-chip">{finding.status === 'open' ? 'Abierto' : 'Cerrado'}</span>
            <p>{finding.description}</p>
            <p><strong>Acción correctiva:</strong> {finding.correctiveAction}</p>
            <p>Fecha límite: {calendar.format(new Date(finding.dueOn))} (Lima).</p>
            {finding.hasEvidence === 1 &&
              <a className="button tonal" href={'/api' + url + '/' + encodeURIComponent(finding.id) + '/evidence'}>Descargar evidencia</a>}
          </li>
        ))}
      </ul>
    </section>
  );
}
