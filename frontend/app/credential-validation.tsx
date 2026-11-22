'use client';

import { useEffect, useState } from 'react';
import { api, ApiFailure } from './api';

type Validation = { status: 'active' | 'expired' | 'revoked'; expiresAt: string };
const dateFormat = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' });
const resultLabels = {
  active: 'Estibador habilitado',
  expired: 'Credencial vencida',
  revoked: 'Credencial revocada',
};

export function CredentialValidation({ token }: { token: string }) {
  const [result, setResult] = useState<Validation | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setResult(null);
    void api<Validation>('/stevedore-credentials/' + encodeURIComponent(token), { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setResult(result); })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setError(error instanceof ApiFailure ? error.message : 'No pudimos validar la credencial.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, refresh]);

  return (
    <section className="main-panel panel" aria-labelledby="validation-title">
      <h2 id="validation-title">Resultado de la consulta</h2>
      {loading && <p className="secondary" role="status">Verificando la credencial…</p>}
      {error && <p className="feedback error validation-feedback" role="alert">{error} Servicio sin autorización.</p>}
      {result && <div role="status" className={'feedback validation-feedback ' + (result.status === 'active' ? 'success' : 'error')}>
        <strong>{resultLabels[result.status]}</strong>
        <p>Vence (Lima) {dateFormat.format(new Date(result.expiresAt))}.</p>
        {result.status !== 'active' && <p>Servicio sin autorización.</p>}
      </div>}
      <button className="button outline" type="button" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>Volver a comprobar</button>
    </section>
  );
}
