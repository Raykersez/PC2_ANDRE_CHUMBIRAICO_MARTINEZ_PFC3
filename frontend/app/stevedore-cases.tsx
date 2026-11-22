'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiFailure } from './api';
import { Field } from './components';
import type { Fields } from './types';

export type StevedoreRecord = { code: string; name: string; status: 'pending' | 'verified' | 'observed'; createdAt: string };
export const stevedoreStatus = { pending: 'Pendiente de verificación', verified: 'Verificado', observed: 'Observado' };
const fileFormats = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

export function StevedoreCases({ busy, setBusy }: { busy: boolean; setBusy: (value: boolean) => void }) {
  const [records, setRecords] = useState<StevedoreRecord[]>([]);
  const [selected, setSelected] = useState<StevedoreRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<Fields>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void api<{ records: StevedoreRecord[] }>('/stevedores', { signal: controller.signal })
      .then(({ records }) => { if (!controller.signal.aborted) setRecords(records); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setError(error instanceof ApiFailure ? error.message : 'No pudimos cargar tus expedientes.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setFields({});
    setNotice('');
    try {
      const { record } = await api<{ record: StevedoreRecord }>('/stevedores', { method: 'POST', body: data });
      setRecords((items) => [record, ...items]);
      setSelected(record);
      setNotice('Expediente registrado. Conserva el número para consultar el trámite.');
    } catch (error) {
      setError(error instanceof ApiFailure ? error.message : 'No pudimos registrar el expediente. Vuelve a intentarlo.');
      if (error instanceof ApiFailure) {
        setFields(error.fields);
        if (error.status === 409) {
          try {
            const { records } = await api<{ records: StevedoreRecord[] }>('/stevedores');
            setRecords(records);
          } catch {
            // Conserva el mensaje de duplicado si falla la consulta.
          }
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function view(code: string) {
    setBusy(true);
    setFields({});
    setError('');
    setNotice('');
    try {
      const { record } = await api<{ record: StevedoreRecord }>('/stevedores/' + encodeURIComponent(code));
      setSelected(record);
      setRecords((items) => items.map((item) => item.code === code ? record : item));
    } catch (error) {
      setError(error instanceof ApiFailure ? error.message : 'No pudimos abrir el expediente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 id="form-title">Expediente de estibador</h2>
      {error && <p className="feedback error" role="alert">{error}</p>}
      {notice && <p className="feedback success" role="status">{notice}</p>}
      {selected ? (
        <>
          <dl className="receipt">
            <div><dt>Número de expediente</dt><dd className="code">{selected.code}</dd></div>
            <div><dt>Estibador</dt><dd>{selected.name}</dd></div>
            <div><dt>Estado</dt><dd>{stevedoreStatus[selected.status]}</dd></div>
          </dl>
          <div className="receipt-actions">
            <a className="button tonal" href={'/api/stevedores/' + selected.code + '/attachments/identity'}>Descargar identificación</a>
            <a className="button tonal" href={'/api/stevedores/' + selected.code + '/attachments/support'}>Descargar sustento laboral</a>
            <button className="button outline" disabled={busy} onClick={() => view(selected.code)}>Recargar expediente</button>
            <button className="button outline" disabled={busy} onClick={() => { setSelected(null); setNotice(''); }}>Volver a mis expedientes</button>
          </div>
        </>
      ) : (
        <>
          {loading && <p className="secondary" role="status">Cargando tus expedientes…</p>}
          {records.length > 0 && <ul className="operation-list">
            {records.map((item) => <li key={item.code}>
              <button className="record" disabled={busy} onClick={() => view(item.code)}>
                <strong>{item.code}</strong><span>{stevedoreStatus[item.status]}</span>
              </button>
            </li>)}
          </ul>}
          <form onSubmit={submit}>
            <p className="secondary">Completa tus datos y adjunta los documentos para solicitar tu certificación.</p>
            <Field name="stevedore-name" label="Nombres y apellidos" error={fields.name}>
              <input id="stevedore-name" name="name" autoComplete="name" required minLength={3} maxLength={120}
                aria-invalid={Boolean(fields.name)} aria-describedby="stevedore-name-hint" />
            </Field>
            <div className="field-grid">
              <Field name="stevedore-document-type" label="Tipo de documento">
                <select id="stevedore-document-type" name="documentType">
                  <option value="DNI">DNI</option><option value="CE">Carné de extranjería</option>
                </select>
              </Field>
              <Field name="stevedore-document" label="Número de documento" error={fields.document} helper="DNI de 8 dígitos o carné de 9 a 12 dígitos.">
                <input id="stevedore-document" name="document" required inputMode="numeric" maxLength={24} autoComplete="off"
                  aria-invalid={Boolean(fields.document)} aria-describedby="stevedore-document-hint" />
              </Field>
            </div>
            <Field name="stevedore-identity" label="Copia del documento de identidad" error={fields.identity} helper="PDF, JPG o PNG. Máximo 2 MB.">
              <input id="stevedore-identity" name="identity" type="file" required accept={fileFormats}
                aria-invalid={Boolean(fields.identity)} aria-describedby="stevedore-identity-hint" />
            </Field>
            <Field name="stevedore-support" label="Documento de sustento laboral" error={fields.support} helper="PDF, JPG o PNG. Máximo 2 MB.">
              <input id="stevedore-support" name="support" type="file" required accept={fileFormats}
                aria-invalid={Boolean(fields.support)} aria-describedby="stevedore-support-hint" />
            </Field>
            <button className="button filled" disabled={busy || loading}>{busy ? 'Enviando…' : 'Registrar expediente'}</button>
          </form>
        </>
      )}
    </>
  );
}
