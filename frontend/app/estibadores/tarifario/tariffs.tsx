'use client';

import { useEffect, useState } from 'react';
import { api, ApiFailure } from '../../api';
import { Field } from '../../components';

type Rate = { id: number; cents: number; unit: string; startsOn: string; endsOn: string | null };
type Service = { code: string; name: string; rate: Rate | null };
type Tariff = { asOf: string; services: Service[] };

const money = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
const date = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'UTC' });
const formatDate = (value: string) => date.format(new Date(value));

export function StevedoreTariffs() {
  const [catalogue, setCatalogue] = useState<Tariff | null>(null);
  const [selection, setSelection] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void api<Tariff>('/stevedore-tariffs', { signal: controller.signal })
      .then((catalogue) => { if (!controller.signal.aborted) setCatalogue(catalogue); })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setError(error instanceof ApiFailure ? error.message : 'No pudimos cargar el tarifario.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  const services = catalogue?.services ?? [];
  const visible = selection ? services.filter(({ code }) => code === selection) : services;

  return (
    <section className="panel main-panel" aria-labelledby="tariff-title" aria-busy={loading}>
      <h2 id="tariff-title">Tarifas por servicio</h2>
      {loading && <p role="status" className="secondary">Consultando tarifas vigentes…</p>}
      {error && <>
        <p className="feedback error validation-feedback" role="alert">{error}</p>
        <button className="button outline" type="button" onClick={() => setRefresh((value) => value + 1)}>Reintentar</button>
      </>}
      {catalogue && !error && (
        <>
          <p className="secondary">Vigencia consultada el {formatDate(catalogue.asOf)} (Lima).</p>
          {services.length === 0 ? <p className="secondary">Aún no hay tarifas publicadas.</p> : (
            <div className="tariff-catalogue">
              <Field name="tariff-service" label="Tipo de servicio">
                <select id="tariff-service" value={selection} onChange={(event) => setSelection(event.target.value)}>
                  <option value="">Todos los servicios</option>
                  {services.map(({ code, name }) => <option value={code} key={code}>{name}</option>)}
                </select>
              </Field>
              <ul className="tariff-list" aria-live="polite">
                {visible.map(({ code, name, rate }) => (
                  <li className="panel" key={code}>
                    <h3>{name}</h3>
                    {rate ? (
                      <>
                        <p><strong>{money.format(rate.cents / 100)}</strong> por {rate.unit}</p>
                        <p className="secondary">Vigente desde el {formatDate(rate.startsOn)}.</p>
                        {rate.endsOn && <p className="secondary">Finaliza al comenzar el {formatDate(rate.endsOn)}.</p>}
                      </>
                    ) : <p className="secondary">No hay una tarifa publicada y vigente para este servicio.</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
