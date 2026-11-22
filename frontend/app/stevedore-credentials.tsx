'use client';

import Image from 'next/image';
import { useState, type FormEvent } from 'react';
import { api, ApiFailure } from './api';
import { Field } from './components';
import type { StevedoreRecord } from './stevedore-cases';

type Credential = { token: string; status: 'active' | 'expired' | 'revoked'; expiresAt: string; validationUrl: string };
type CredentialCase = Pick<StevedoreRecord, 'code' | 'status'> & { credential: Credential | null };
const dateFormat = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' });
const statusLabels = { active: 'Vigente', expired: 'Vencida', revoked: 'Revocada' };

export function StevedoreCredentials({ busy, setBusy, caseStatusLabels }: {
  busy: boolean;
  setBusy: (value: boolean) => void;
  caseStatusLabels: Record<StevedoreRecord['status'], string>;
}) {
  const [record, setRecord] = useState<CredentialCase | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const credential = record?.credential;

  async function manage(code: string, issue: boolean) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    if (!issue) setRecord(null);
    try {
      const { record } = await api<{ record: CredentialCase }>('/stevedores/' + encodeURIComponent(code) + '/credential',
        { method: issue ? 'POST' : 'GET' });
      setRecord(record);
      if (issue) setNotice('La credencial se emitió correctamente.');
    } catch (error) {
      setError(error instanceof ApiFailure ? error.message : 'No pudimos completar la operación.');
    } finally {
      setBusy(false);
    }
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') ?? '').trim().toUpperCase();
    void manage(code, false);
  }

  async function revoke(credential: Credential) {
    if (busy || !window.confirm('¿Revocar esta credencial? El QR dejará de autorizar el servicio.')) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { status } = await api<Pick<Credential, 'status'>>('/stevedore-credentials/' + credential.token + '/revoke', { method: 'POST' });
      setRecord((current) => current && { ...current, credential: { ...credential, status } });
      setNotice(status === 'revoked' ? 'La credencial quedó revocada.' : 'La credencial ya está vencida.');
    } catch (error) {
      setError(error instanceof ApiFailure ? error.message : 'No pudimos revocar la credencial.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="credential-panel" aria-labelledby="credentials-title">
      <h3 id="credentials-title">Control de credenciales QR</h3>
      {error && <p className="feedback error" role="alert">{error}</p>}
      {notice && <p className="feedback success" role="status">{notice}</p>}
      <form onSubmit={search}>
        <Field name="credential-case-code" label="Número de expediente">
          <input id="credential-case-code" name="code" required maxLength={19} placeholder="ES-…" autoComplete="off" />
        </Field>
        <button className="button tonal" disabled={busy}>Consultar credencial</button>
      </form>
      {record && (
        <>
          <dl className="receipt">
            <div><dt>Expediente</dt><dd className="code">{record.code}</dd></div>
            <div><dt>Estado del expediente</dt><dd>{caseStatusLabels[record.status]}</dd></div>
            {credential && (
              <>
                <div><dt>Estado de la credencial</dt><dd>{statusLabels[credential.status]}</dd></div>
                <div><dt>Vence (Lima)</dt><dd>{dateFormat.format(new Date(credential.expiresAt))}</dd></div>
              </>
            )}
          </dl>
          {credential?.status === 'active' && (
            <>
              <Image className="stevedore-qr" src={'/api/stevedore-credentials/' + credential.token + '/qr'}
                width={224} height={224} unoptimized alt="Código QR de la credencial" />
              <div className="receipt-actions">
                <a className="button tonal" href={credential.validationUrl}>Abrir validación</a>
                <button className="button outline" disabled={busy} onClick={() => revoke(credential)}>Revocar credencial</button>
              </div>
            </>
          )}
          {record.status === 'verified' && credential?.status !== 'active' && (
            <button className="button filled" disabled={busy} onClick={() => manage(record.code, true)}>Emitir credencial QR</button>
          )}
        </>
      )}
    </section>
  );
}
