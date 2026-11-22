'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { api, ApiFailure } from './api';
import { Brand, Field } from './components';
import { CommercialOperations } from './commercial-operations';
import { ThemeSelect } from './theme-select';
import { StallAssignment } from './stall-assignment';
import { StevedoreCases } from './stevedore-cases';
import type { Application, Fields, User } from './types';

type AuthMode = 'signup' | 'login';

const fileFormats = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
const fileHint = 'PDF, JPG o PNG. Máximo 2 MB.';
const categories = ['Frutas', 'Verduras', 'Tubérculos', 'Abarrotes', 'Otros alimentos'];
const localDate = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'America/Lima' });
const decisionDate = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' });
const statusLabels = { pending: 'Pendiente de revisión', approved: 'Aprobada', observed: 'Observada' };

export function Portal({ initialMode = 'signup', service = 'merchants' }: {
  initialMode?: AuthMode;
  service?: 'merchants' | 'stevedores';
}) {
  const stevedores = service === 'stevedores';
  const [user, setUser] = useState<User | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [receipt, setReceipt] = useState<Application | null>(null);
  const [decision, setDecision] = useState('');
  const [reloadRequired, setReloadRequired] = useState(false);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [fields, setFields] = useState<Fields>({});
  const [documentType, setDocumentType] = useState('DNI');

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    async function load() {
      try {
        const session = await api<{ user: User }>('/session', options);
        if (controller.signal.aborted) return;
        setUser(session.user);
        if (stevedores) return;
        const result = await api<{ applications: Application[] }>('/applications', options);
        if (!controller.signal.aborted) setApplications(result.applications);
      } catch (error) {
        if (!controller.signal.aborted && (!(error instanceof ApiFailure) || error.status !== 401)) {
          setMessage('No pudimos consultar tu sesión. Si persiste el problema, recarga la página.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [stevedores]);

  function openAuth(value: AuthMode) {
    setMode(value);
    setFields({});
    setMessage('');
  }

  function clearFeedback() {
    setMessage('');
    setNotice('');
    setFields({});
  }

  function showError(error: unknown) {
    if (error instanceof ApiFailure) {
      setMessage(error.message);
      setFields(error.fields);
      if (error.status === 401 && user) {
        setUser(null);
        setApplications([]);
        setReceipt(null);
        setMode('login');
      }
    } else {
      setMessage('No pudimos completar la operación. Inténtalo de nuevo.');
    }
  }

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    clearFeedback();
    setBusy(true);
    try {
      const result = await api<{ user: User }>('/session/' + mode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.get('email'), password: data.get('password') }),
      });
      setUser(result.user);
      if (stevedores) return;
      const records = await api<{ applications: Application[] }>('/applications');
      setApplications(records.applications);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    clearFeedback();
    setBusy(true);
    try {
      await api('/session', { method: 'DELETE' });
      setUser(null);
      setApplications([]);
      setReceipt(null);
      openAuth('login');
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    clearFeedback();
    const errors: Fields = {};
    for (const kind of ['identity', 'support']) {
      const file = data.get(kind);
      if (!(file instanceof File) || !file.size || file.size > 2 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
        errors[kind] = 'Selecciona un PDF, JPG o PNG de hasta 2 MB.';
      }
    }
    if (Object.keys(errors).length) {
      setFields(errors);
      setMessage('Revisa los documentos marcados.');
      return;
    }

    setBusy(true);
    try {
      const result = await api<{ application: Application }>('/applications', { method: 'POST', body: data });
      setReceipt(result.application);
      setApplications((items) => [result.application, ...items]);
      setNotice('Solicitud registrada. Conserva tu código para consultarla.');
    } catch (error) {
      if (error instanceof ApiFailure && error.application) {
        setReceipt(error.application);
        setNotice(error.message);
      } else {
        showError(error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function lookUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') ?? '').trim();
    await loadReceipt(code);
  }

  function updateReceipt(application: Application) {
    setReceipt(application);
    setApplications((items) => items.map((item) => item.code === application.code ? application : item));
    setDecision('');
    setReloadRequired(false);
  }

  async function loadReceipt(code: string) {
    clearFeedback();
    setBusy(true);
    try {
      const result = await api<{ application: Application }>('/applications/' + encodeURIComponent(code));
      updateReceipt(result.application);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function saveDecision(event: FormEvent<HTMLFormElement>, code: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    clearFeedback();
    setBusy(true);
    try {
      const result = await api<{ application: Application }>('/applications/' + encodeURIComponent(code) + '/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason: form.get('reason'), reviewed: form.has('reviewed') }),
      });
      updateReceipt(result.application);
      setNotice('Se registró la decisión del expediente.');
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 409) setReloadRequired(true);
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <a className="skip" href="#tramite">Ir al trámite</a>
      <header className="top-bar">
        <div className="shell top-content">
          <a href="/" aria-label="Inicio de MercaOrden"><Brand /></a>
          <nav aria-label="Navegación principal">
            <a className="nav-link" href={stevedores ? '/empadronamiento' : '#tramite'}>Empadronamiento</a>
            <a className="nav-link" href={stevedores ? '#tramite' : '/estibadores'}>Estibadores</a>
            {!stevedores && <a className="nav-link" href="#expedientes">Mis solicitudes</a>}
            {!stevedores && user?.role === 'merchant' && <a className="nav-link" href="#operaciones">Operaciones</a>}
          </nav>
          <div className="header-actions">
            <ThemeSelect />
            {user ? <button className="button outline session-button" disabled={busy} onClick={signOut}>Cerrar sesión</button>
              : <a className="button outline session-button" href="#tramite" onClick={() => openAuth('login')}>Iniciar sesión</a>}
          </div>
        </div>
      </header>

      <main className="shell">
        <section className="intro" aria-labelledby="page-title">
          {!stevedores && <div className="eyebrow"><span aria-hidden="true" /> Servicios para comerciantes</div>}
          <h1 id="page-title">{stevedores ? 'Certificación de estibadores' : <>Empadronamiento <em>digital.</em></>}</h1>
          <p>{stevedores ? 'Solicita tu certificación para trabajar como estibador en el mercado mayorista.' :
            'Presenta tus datos y documentos para iniciar tu formalización en el mercado mayorista.'}</p>
        </section>

        <div className="workspace">
          <section className="panel main-panel" id="tramite" tabIndex={-1} aria-labelledby="form-title" aria-busy={loading || busy}>
            {message && <p className="feedback error" role="alert">{message}</p>}
            {notice && <p className="feedback success" role="status">{notice}</p>}
            {loading ? (
              <div role="status" className="loading"><h2 id="form-title">Preparando tu trámite</h2><p>Estamos comprobando tu sesión.</p></div>
            ) : !user ? (
              <>
                <h2 id="form-title">{mode === 'signup' ? 'Inicia tu solicitud' : 'Ingresa a tu cuenta'}</h2>
                <p className="secondary">Usa tu cuenta para enviar documentos y consultar el estado de tu expediente.</p>
                <div className="segmented" aria-label="Acceso a la cuenta">
                  <button type="button" aria-pressed={mode === 'signup'} disabled={busy} onClick={() => openAuth('signup')}>Crear cuenta</button>
                  <button type="button" aria-pressed={mode === 'login'} disabled={busy} onClick={() => openAuth('login')}>Iniciar sesión</button>
                </div>
                <form key={mode} onSubmit={authenticate}>
                  <Field name="email" label="Correo electrónico" error={fields.email}>
                    <input id="email" name="email" type="email" autoComplete="email" placeholder="tu@correo.pe" required maxLength={254}
                      aria-invalid={Boolean(fields.email)} aria-describedby="email-hint" />
                  </Field>
                  <Field name="password" label="Contraseña" error={fields.password} helper={mode === 'signup' ? 'Usa al menos 10 caracteres.' : undefined}>
                    <input id="password" name="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      required minLength={mode === 'signup' ? 10 : undefined} maxLength={128}
                      aria-invalid={Boolean(fields.password)} aria-describedby="password-hint" />
                  </Field>
                  <button className="button filled" type="submit" disabled={busy}>{busy ? 'Un momento…' : mode === 'signup' ? 'Crear cuenta y continuar' : 'Entrar a mi cuenta'}</button>
                </form>
                <div className="receipt-actions">
                  {mode === 'login' && <a className="button tonal" href="/?ayuda=acceso#contacto">Solicitar ayuda para recuperar el acceso</a>}
                  <a className="button outline" href="/">Volver al inicio</a>
                </div>
              </>
            ) : stevedores ? (
              <StevedoreCases key={user.id} busy={busy} setBusy={setBusy} />
            ) : receipt ? (
              <>
                <p className="status-chip">{statusLabels[receipt.status]}</p>
                <h2 id="form-title">{user.role === 'merchant' ? 'Mi expediente' : 'Expediente de empadronamiento'}</h2>
                {user.role === 'merchant' && receipt.status === 'approved' && !receipt.assignment && (
                  <p className="secondary">Tu solicitud fue aprobada. La administración del mercado aún debe asignarte un puesto.</p>
                )}
                <dl className="receipt">
                  <div><dt>Código de solicitud</dt><dd className="code">{receipt.code}</dd></div>
                  <div><dt>Solicitante</dt><dd>{receipt.name}</dd></div>
                  <div><dt>Rubro</dt><dd>{receipt.category}</dd></div>
                  <div><dt>Fecha de presentación</dt><dd>{localDate.format(new Date(receipt.createdAt))}</dd></div>
                  {receipt.decision && <>
                    <div><dt>Fecha de resolución (Lima)</dt><dd>{decisionDate.format(new Date(receipt.decision.decidedAt))}</dd></div>
                    {receipt.decision.evaluatorId && <div><dt>ID del evaluador</dt><dd>{receipt.decision.evaluatorId}</dd></div>}
                    {receipt.decision.reason && <div><dt>Qué debes corregir</dt><dd>{receipt.decision.reason}</dd></div>}
                  </>}
                  {receipt.assignment && <>
                    <div><dt>{user.role === 'merchant' ? 'Puesto asignado' : 'Puesto ocupado'}</dt>
                      <dd>{receipt.assignment.code} · {receipt.assignment.location}</dd></div>
                    <div><dt>Fecha de asignación (Lima)</dt><dd>{decisionDate.format(new Date(receipt.assignment.assignedAt))}</dd></div>
                  </>}
                </dl>
                {user.role !== 'market_admin' && <div className="receipt-actions">
                  <a className="button tonal" href={'/api/applications/' + receipt.code + '/attachments/identity'}>Descargar identificación</a>
                  <a className="button tonal" href={'/api/applications/' + receipt.code + '/attachments/support'}>Descargar sustento</a>
                </div>}
                {user.role === 'market_admin' && receipt.status === 'approved' && !receipt.assignment && (
                  <StallAssignment key={receipt.code} code={receipt.code} busy={busy} setBusy={setBusy}
                    onAssigned={(assignment) => {
                      updateReceipt({ ...receipt, assignment });
                      setNotice('El puesto quedó asignado al comerciante.');
                    }} />
                )}
                {user.role === 'staff' && receipt.status === 'pending' && !reloadRequired && (
                  <form onSubmit={(event) => saveDecision(event, receipt.code)}>
                    <h3>Resolver solicitud</h3>
                    <Field name="decision" label="Decisión" error={fields.decision}>
                      <select id="decision" required value={decision} onChange={(event) => setDecision(event.target.value)}
                        disabled={busy} aria-describedby="decision-hint">
                        <option value="">Selecciona una decisión</option>
                        <option value="approved">Aprobar</option>
                        <option value="observed">Observar</option>
                      </select>
                    </Field>
                    {decision === 'approved' && (
                      <label className="review-check">
                        <input type="checkbox" name="reviewed" required disabled={busy} aria-describedby="reviewed-hint" />
                        <span>Verifiqué la identificación y el sustento comercial. Ambos cumplen los requisitos.</span>
                        <span id="reviewed-hint" className="field-error">{fields.reviewed}</span>
                      </label>
                    )}
                    {decision === 'observed' && (
                      <Field name="reason" label="Motivo de la observación" error={fields.reason} helper="Indica qué documento falta o qué debe corregir el comerciante.">
                        <textarea id="reason" name="reason" required maxLength={1000} rows={4}
                          readOnly={busy} aria-invalid={Boolean(fields.reason)} aria-describedby="reason-hint" />
                      </Field>
                    )}
                    <button className="button filled" disabled={busy}>{busy ? 'Guardando…' : 'Guardar decisión'}</button>
                  </form>
                )}
                <div className="receipt-actions">
                  {(reloadRequired || user.role === 'merchant' || (user.role === 'market_admin' && !receipt.assignment)) &&
                    <button className="button outline" disabled={busy} onClick={() => loadReceipt(receipt.code)}>Recargar estado</button>}
                  <button className="button outline" disabled={busy} onClick={() => { setReceipt(null); clearFeedback(); }}>
                    {user.role === 'merchant' ? 'Volver al formulario' : 'Consultar otro expediente'}
                  </button>
                </div>
              </>
            ) : user.role !== 'merchant' ? (
              <>
                <h2 id="form-title">Consultar expediente</h2>
                <p className="secondary">Ingresa el código que recibió el comerciante.</p>
                <form onSubmit={lookUp}>
                  <Field name="code" label="Código de solicitud">
                    <input id="code" name="code" required placeholder="MO-…" maxLength={19} autoComplete="off" />
                  </Field>
                  <button className="button filled" disabled={busy}>{busy ? 'Buscando…' : 'Consultar'}</button>
                </form>
              </>
            ) : (
              <>
                <h2 id="form-title">Solicitud de empadronamiento</h2>
                <p className="secondary">Completa todos los campos y adjunta ambos documentos.</p>
                <form onSubmit={submitApplication}>
                  <Field name="name" label="Nombres y apellidos" error={fields.name}>
                    <input id="name" name="name" required minLength={3} maxLength={120} autoComplete="name"
                      aria-invalid={Boolean(fields.name)} aria-describedby="name-hint" />
                  </Field>
                  <div className="field-grid">
                    <Field name="documentType" label="Tipo de documento">
                      <select id="documentType" name="documentType" value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
                        <option value="DNI">DNI</option><option value="CE">Carné de extranjería</option>
                      </select>
                    </Field>
                    <Field name="document" label="Número de documento" error={fields.document} helper={documentType === 'DNI' ? '8 dígitos.' : 'Entre 9 y 12 dígitos.'}>
                      <input id="document" name="document" required inputMode="numeric" maxLength={24} autoComplete="off"
                        aria-invalid={Boolean(fields.document)} aria-describedby="document-hint" />
                    </Field>
                  </div>
                  <Field name="category" label="Rubro comercial" error={fields.category}>
                    <select id="category" name="category" defaultValue="" required aria-invalid={Boolean(fields.category)} aria-describedby="category-hint">
                      <option value="" disabled>Selecciona tu rubro</option>
                      {categories.map((category) => <option key={category}>{category}</option>)}
                    </select>
                  </Field>
                  <div className="documents">
                    <Field name="identity" label="Copia del documento de identidad" error={fields.identity} helper={fileHint}>
                      <input id="identity" name="identity" type="file" accept={fileFormats} required aria-invalid={Boolean(fields.identity)} aria-describedby="identity-hint" />
                    </Field>
                    <Field name="support" label="Documento de sustento comercial" error={fields.support} helper={fileHint}>
                      <input id="support" name="support" type="file" accept={fileFormats} required aria-invalid={Boolean(fields.support)} aria-describedby="support-hint" />
                    </Field>
                  </div>
                  <button className="button filled" type="submit" disabled={busy}>{busy ? 'Enviando documentos…' : 'Enviar solicitud'}</button>
                </form>
              </>
            )}
          </section>

          {stevedores ? <aside className="requirements" aria-labelledby="stevedore-requirements">
            <h2 id="stevedore-requirements">Documentos requeridos</h2>
            <ul><li>DNI o carné de extranjería</li><li>Documento de sustento laboral</li></ul>
            <p>Usa archivos PDF, JPG o PNG de hasta 2 MB cada uno.</p>
          </aside> : <aside className="side">
            <section className="requirements" aria-labelledby="requirements-title">
              <div className="check-mark" aria-hidden="true">✓</div>
              <h2 id="requirements-title">Ten a mano</h2>
              <ul><li>Tu DNI o carné de extranjería</li><li>Un documento de sustento comercial</li><li>El rubro de tu negocio</li></ul>
              <p>Consulta con la administración del mercado si tienes dudas sobre el documento de sustento.</p>
            </section>
            <section className="panel records" id="expedientes" aria-labelledby="records-title">
              <h2 id="records-title">Mis solicitudes</h2>
              {applications.length ? (
                <ul>{applications.map((application) => (
                  <li key={application.code}>
                    <button className="record" type="button" disabled={busy} onClick={() => {
                      void loadReceipt(application.code);
                      document.getElementById('tramite')?.focus();
                    }}>
                      <strong>{application.code}</strong><span>{statusLabels[application.status]}</span>
                    </button>
                  </li>
                ))}</ul>
              ) : <p className="secondary">{user ? 'Aquí aparecerán tus solicitudes registradas.' : 'Inicia sesión para consultar tus expedientes.'}</p>}
            </section>
          </aside>}
        </div>
        {!stevedores && user?.role === 'merchant' && <CommercialOperations key={user.id} />}
      </main>
      <footer className="shell footer"><a href="/" aria-label="Inicio de MercaOrden"><Brand /></a><span>Formalización para mercados mayoristas</span></footer>
    </>
  );
}
