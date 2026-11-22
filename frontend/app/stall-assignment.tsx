'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiFailure } from './api';
import { Field } from './components';
import type { Assignment, Stall } from './types';

export function StallAssignment({ code, busy, setBusy, onAssigned }: {
  code: string;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onAssigned: (assignment: Assignment) => void;
}) {
  const path = '/applications/' + encodeURIComponent(code);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [stallCode, setStallCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setStalls([]);
    setStallCode('');

    void api<{ stalls: Stall[] }>(path + '/stalls', { signal: controller.signal })
      .then(({ stalls }) => { if (!controller.signal.aborted) setStalls(stalls); })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setError(error instanceof ApiFailure ? error.message : 'No pudimos cargar los puestos.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, refresh]);

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !stallCode || error) return;
    setError('');
    setBusy(true);
    try {
      const { assignment } = await api<{ assignment: Assignment }>(path + '/assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stallCode }),
      });
      onAssigned(assignment);
    } catch (error) {
      setError(error instanceof ApiFailure ? error.message : 'No pudimos confirmar la asignación. Recarga el expediente antes de reintentar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={assign} aria-busy={loading || busy}>
      <h3>Asignar puesto</h3>
      {loading && <p role="status">Cargando puestos compatibles…</p>}
      {error && <p role="alert" className="feedback error">{error}</p>}
      {!loading && !error && stalls.length === 0 && <p role="status">No hay puestos libres para este rubro.</p>}
      {!loading && !error && stalls.length > 0 && <>
        <Field name="stallCode" label="Puesto disponible">
          <select id="stallCode" value={stallCode} required disabled={busy}
            onChange={(event) => setStallCode(event.target.value)}>
            <option value="">Selecciona un puesto</option>
            {stalls.map((stall) => <option key={stall.code} value={stall.code}>{stall.code} · {stall.location}</option>)}
          </select>
        </Field>
        <button className="button filled" type="submit" disabled={busy || !stallCode}>
          {busy ? 'Guardando…' : 'Confirmar asignación'}
        </button>
      </>}
      <button className="button outline" type="button" disabled={busy || loading} onClick={() => setRefresh((value) => value + 1)}>
        Actualizar puestos
      </button>
    </form>
  );
}
