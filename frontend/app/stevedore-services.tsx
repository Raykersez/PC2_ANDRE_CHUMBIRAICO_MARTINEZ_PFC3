'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiFailure } from './api';
import { Field } from './components';
import type { Fields } from './types';

type Service = { code: string; name: string };
type Request = {
  code: string; serviceName: string; startsAt: number; endsAt: number;
  assignment: {
    tariffVersion: number; amountCents: number; unit: string;
    caseCode: string; stevedoreName: string; assignedAt: number; coordinatorId?: string;
  } | null;
};
type History = { canAssign: boolean; requests: Request[] };
type Options = {
  rate: { id: number; cents: number; unit: string };
  candidates: { code: string; name: string }[];
};
const time = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' });
const money = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
const price = (cents: number) => money.format(cents / 100);
const endpoint = '/stevedore-service-requests';

export function StevedoreServices({ canRequest, busy, setBusy }: {
  canRequest: boolean; busy: boolean; setBusy: (value: boolean) => void;
}) {
  const [history, setHistory] = useState<History | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selection, setSelection] = useState<{ code: string; options: Options } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [fields, setFields] = useState<Fields>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    setError('');
    setLoading(true);
    void Promise.all([
      api<History>(endpoint, options),
      api<{ services: Service[] }>('/stevedore-tariffs', options),
    ]).then(([history, catalogue]) => {
      if (controller.signal.aborted) return;
      setHistory(history);
      setServices(catalogue.services);
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(failure instanceof ApiFailure ? failure.message : 'No pudimos cargar los servicios.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setFields({});
    setError('');
    setNotice('');
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : 'No pudimos completar la operación.');
      if (failure instanceof ApiFailure) setFields(failure.fields);
    } finally {
      setBusy(false);
    }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    void run(async () => {
      const { request } = await api<{ request: Request }>(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      setHistory((history) => history && { ...history, requests: [request, ...history.requests] });
      form.reset();
      setNotice('Solicitud registrada con el código ' + request.code + '.');
    });
  }

  function choose(code: string) {
    setSelection(null);
    void run(async () => {
      const options = await api<Options>(endpoint + '/' + encodeURIComponent(code) + '/options');
      setSelection({ code, options });
    });
  }

  function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection) return;
    const caseCode = new FormData(event.currentTarget).get('caseCode');
    const { code, options } = selection;
    setSelection(null);
    void run(async () => {
      const { request } = await api<{ request: Request }>(endpoint + '/' + encodeURIComponent(code) + '/assignment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseCode, tariffVersion: options.rate.id }),
      });
      setHistory((history) => history && {
        ...history, requests: history.requests.map((item) => item.code === code ? request : item),
      });
      setNotice('Servicio asignado. El monto y la versión de la tarifa quedaron registrados.');
    });
  }

  return (
    <>
      <h2 id="form-title">Solicitudes de estibaje</h2>
      {loading && <p className="secondary" role="status">Consultando solicitudes…</p>}
      {error && <p className="feedback error logistics-feedback" role="alert">{error}</p>}
      {notice && <p className="feedback success logistics-feedback" role="status">{notice}</p>}
      <div className="receipt-actions">
        {!loading && <button type="button" className="button outline" disabled={busy}
          onClick={() => { setSelection(null); setRefresh((value) => value + 1); }}>Actualizar solicitudes</button>}
      </div>
      {history && canRequest && !history.canAssign && (
        services.length === 0 ? <p className="secondary">Todavía no hay servicios publicados.</p> : (
          <form onSubmit={create}>
            <h3>Solicitar servicio</h3>
            <Field name="service-choice" label="Tipo de servicio" error={fields.serviceCode}>
              <select id="service-choice" name="serviceCode" required defaultValue="" aria-describedby="service-choice-hint"
                aria-invalid={Boolean(fields.serviceCode)} disabled={busy}>
                <option value="">Selecciona un servicio</option>
                {services.map(({ code, name }) => <option value={code} key={code}>{name}</option>)}
              </select>
            </Field>
            <div className="field-grid">
              <Field name="service-start" label="Inicio (Lima)" error={fields.start}>
                <input id="service-start" name="start" type="datetime-local" required readOnly={busy}
                  aria-invalid={Boolean(fields.start)} aria-describedby="service-start-hint" />
              </Field>
              <Field name="service-end" label="Fin (Lima)" error={fields.end}>
                <input id="service-end" name="end" type="datetime-local" required readOnly={busy}
                  aria-invalid={Boolean(fields.end)} aria-describedby="service-end-hint" />
              </Field>
            </div>
            <button className="button filled" disabled={busy}>{busy ? 'Procesando…' : 'Registrar solicitud'}</button>
          </form>
        )
      )}
      {history && (
        <div className="receipt-actions service-requests">
          <h3>{history.canAssign ? 'Solicitudes para coordinar' : 'Mis solicitudes'}</h3>
          {history.requests.length === 0 && <p className="secondary">Todavía no hay solicitudes registradas.</p>}
          <ul className="operation-list">
            {history.requests.map((request) => (
              <li key={request.code}>
                <strong>{request.serviceName} · {request.code}</strong>
                <p>{time.format(request.startsAt)} – {time.format(request.endsAt)} (Lima)</p>
                {request.assignment ? (
                  <dl className="receipt">
                    <div><dt>Estibador asignado</dt><dd>{request.assignment.stevedoreName} · {request.assignment.caseCode}</dd></div>
                    <div><dt>Tarifa acordada</dt><dd>{price(request.assignment.amountCents)} por {request.assignment.unit} · Versión {request.assignment.tariffVersion}</dd></div>
                    <div><dt>Asignado el</dt><dd>{time.format(request.assignment.assignedAt)} (Lima)</dd></div>
                    {request.assignment.coordinatorId && <div><dt>Coordinador responsable</dt><dd className="code">{request.assignment.coordinatorId}</dd></div>}
                  </dl>
                ) : (
                  <>
                    <p className="secondary">Pendiente de asignación.</p>
                    {history.canAssign && selection?.code !== request.code &&
                      <button type="button" className="button tonal" disabled={busy} onClick={() => choose(request.code)}>Consultar estibadores y tarifa</button>}
                    {selection?.code === request.code && (
                      <form onSubmit={assign}>
                        <p>Tarifa oficial vigente: <strong>{price(selection.options.rate.cents)}</strong> por {selection.options.rate.unit} · Versión {selection.options.rate.id}</p>
                        {selection.options.candidates.length === 0 ? <p>No hay estibadores habilitados y libres en esta franja.</p> : <>
                          <Field name="assigned-stevedore" label="Estibador disponible">
                            <select id="assigned-stevedore" name="caseCode" required defaultValue="">
                              <option value="">Selecciona un estibador</option>
                              {selection.options.candidates.map(({ code, name }) => <option value={code} key={code}>{name} · {code}</option>)}
                            </select>
                          </Field>
                          <button className="button filled" disabled={busy}>Confirmar asignación</button>
                        </>}
                        <button type="button" className="button outline" disabled={busy} onClick={() => setSelection(null)}>Volver a la solicitud</button>
                      </form>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
