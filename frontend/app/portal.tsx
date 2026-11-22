'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

type User = { id: string; email: string; role: 'merchant' | 'staff' };
type Application = { code: string; name: string; category: string; status: 'pending'; createdAt: string };
type Fields = Record<string, string>;
type Theme = 'system' | 'light' | 'dark';
type AuthMode = 'signup' | 'login';

class ApiFailure extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: Fields = {},
    readonly application: Application | null = null,
  ) { super(message); }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api' + path, { ...init, cache: 'no-store' });
  } catch {
    throw new ApiFailure('No se pudo conectar. Revisa tu conexión y vuelve a intentarlo.', 0);
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiFailure(body.error?.message ?? 'El servicio está temporalmente ocupado. Inténtalo de nuevo.',
      response.status, body.error?.fields, body.application);
  }
  return body as T;
}

function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 13.5 6.8 7h14.4l2.8 6.5M6 15v6h16v-6M4 13.5c0 1.8 3.4 2.6 5 0 1.5 2.5 4 2.5 5 0 1.4 2.5 4 2.5 5 0 1.4 2.5 5 1.8 5 0M9 13.5 10 7m4 6.5V7m5 6.5L18 7M11 21v-4h6v4" />
        </svg>
      </span>
      <span>MercaOrden</span>
    </span>
  );
}

function Field({ name, label, error, helper, children }: {
  name: string; label: string; error?: string; helper?: string; children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children}
      <span id={name + '-hint'} className={error ? 'field-error' : 'hint'}>{error || helper}</span>
    </div>
  );
}

const fileFormats = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
const fileHint = 'PDF, JPG o PNG. Máximo 2 MB.';
const categories = ['Frutas', 'Verduras', 'Tubérculos', 'Abarrotes', 'Otros alimentos'];
const localDate = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'America/Lima' });

export function Portal() {
  const [user, setUser] = useState<User | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [receipt, setReceipt] = useState<Application | null>(null);
  const [mode, setMode] = useState<AuthMode>('signup');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<Theme>('system');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [fields, setFields] = useState<Fields>({});
  const [documentType, setDocumentType] = useState('DNI');

  useEffect(() => {
    const saved = localStorage.getItem('mercaorden-theme');
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
      document.documentElement.dataset.theme = saved;
    }
    const controller = new AbortController();
    const options = { signal: controller.signal };
    async function load() {
      try {
        const session = await api<{ user: User }>('/session', options);
        if (controller.signal.aborted) return;
        setUser(session.user);
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
  }, []);

  function changeTheme(value: Theme) {
    setTheme(value);
    document.documentElement.dataset.theme = value;
    localStorage.setItem('mercaorden-theme', value);
  }

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
    clearFeedback();
    setBusy(true);
    try {
      const result = await api<{ application: Application }>('/applications/' + encodeURIComponent(code));
      setReceipt(result.application);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  function showReceipt(application: Application) {
    clearFeedback();
    setReceipt(application);
    document.getElementById('tramite')?.scrollIntoView();
  }

  return (
    <>
      <a className="skip" href="#tramite">Ir al trámite</a>
      <header className="top-bar">
        <div className="shell top-content">
          <a href="/" aria-label="Inicio de MercaOrden"><Brand /></a>
          <nav aria-label="Navegación principal">
            <a className="nav-link" href="#tramite">Empadronamiento</a>
            <a className="nav-link" href="#expedientes">Mis solicitudes</a>
          </nav>
          <div className="header-actions">
            <select aria-label="Tema de color" className="theme" value={theme} onChange={(event) => changeTheme(event.target.value as Theme)}>
              <option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option>
            </select>
            {user ? <button className="button outline session-button" disabled={busy} onClick={signOut}>Cerrar sesión</button>
              : <a className="button outline session-button" href="#tramite" onClick={() => openAuth('login')}>Iniciar sesión</a>}
          </div>
        </div>
      </header>

      <main className="shell">
        <section className="intro" aria-labelledby="page-title">
          <div className="eyebrow"><span aria-hidden="true" /> Servicios para comerciantes</div>
          <h1 id="page-title">Empadronamiento <em>digital.</em></h1>
          <p>Presenta tus datos y documentos para iniciar tu formalización en el mercado mayorista.</p>
        </section>

        <div className="workspace">
          <section className="panel main-panel" id="tramite" aria-labelledby="form-title" aria-busy={loading || busy}>
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
              </>
            ) : receipt ? (
              <>
                <p className="status-chip">Pendiente de revisión</p>
                <h2 id="form-title">Tu expediente</h2>
                <dl className="receipt">
                  <div><dt>Código de solicitud</dt><dd className="code">{receipt.code}</dd></div>
                  <div><dt>Solicitante</dt><dd>{receipt.name}</dd></div>
                  <div><dt>Rubro</dt><dd>{receipt.category}</dd></div>
                  <div><dt>Fecha de presentación</dt><dd>{localDate.format(new Date(receipt.createdAt))}</dd></div>
                </dl>
                <div className="receipt-actions">
                  <a className="button tonal" href={'/api/applications/' + receipt.code + '/attachments/identity'}>Descargar identificación</a>
                  <a className="button tonal" href={'/api/applications/' + receipt.code + '/attachments/support'}>Descargar sustento</a>
                </div>
                <button className="button outline" onClick={() => { setReceipt(null); clearFeedback(); }}>Volver al formulario</button>
              </>
            ) : user.role === 'staff' ? (
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

          <aside className="side">
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
                    <button className="record" type="button" onClick={() => showReceipt(application)}>
                      <strong>{application.code}</strong><span>Pendiente de revisión</span>
                    </button>
                  </li>
                ))}</ul>
              ) : <p className="secondary">{user ? 'Aquí aparecerán tus solicitudes registradas.' : 'Inicia sesión para consultar tus expedientes.'}</p>}
            </section>
          </aside>
        </div>
      </main>
      <footer className="shell footer"><a href="/" aria-label="Inicio de MercaOrden"><Brand /></a><span>Formalización para mercados mayoristas</span></footer>
    </>
  );
}
