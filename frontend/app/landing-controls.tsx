'use client';

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { api, ApiFailure } from './api';
import { Field } from './components';
import type { Fields, User } from './types';

export function LandingAccess() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void api<{ user: User }>('/session', { signal: controller.signal })
      .then(() => setSignedIn(true))
      .catch(() => {
        if (!controller.signal.aborted) setSignedIn(false);
      });
    return () => controller.abort();
  }, []);

  return signedIn ? (
    <a className="button outline" href="/empadronamiento#expedientes">Mis solicitudes</a>
  ) : (
    <>
      <a className="button outline" href="/empadronamiento?acceso=entrar#tramite">Iniciar sesión</a>
      <a className="button tonal" href="/empadronamiento#tramite">Crear cuenta</a>
    </>
  );
}

const announcementKey = 'mercaorden-announcement-attachments';

export function Announcement() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(sessionStorage.getItem(announcementKey) !== 'dismissed');
  }, []);

  function dismiss(event: MouseEvent<HTMLButtonElement>) {
    const nextSection = event.currentTarget.closest('aside')?.nextElementSibling;
    setVisible(false);
    sessionStorage.setItem(announcementKey, 'dismissed');
    nextSection?.querySelector<HTMLAnchorElement>('a')?.focus();
  }

  if (!visible) return null;
  return (
    <aside className="landing-announcement" aria-label="Antes de iniciar">
      <p>Ten a mano tu identificación y el documento de sustento de tu actividad comercial.</p>
      <button className="button announcement-close" type="button" onClick={dismiss} aria-label="Cerrar anuncio">×</button>
    </aside>
  );
}

export function ContactForm({ recovery }: { recovery: boolean }) {
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Fields>({});
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    sending.current = true;
    setBusy(true);
    setFields({});
    setError('');
    setReceipt('');

    try {
      const result = await api<{ reference: string }>('/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(data)),
      });
      form.reset();
      setReceipt(result.reference);
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : 'No pudimos enviar tu mensaje. Vuelve a intentarlo.');
      if (failure instanceof ApiFailure) setFields(failure.fields);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  function clearFeedback() {
    setFields({});
    setError('');
    setReceipt('');
  }

  return (
    <div className="contact-form">
      {recovery && <p className="feedback success">Indica el correo de tu cuenta y describe el problema para solicitar ayuda.</p>}
      {error && <p className="feedback error" role="alert">{error}</p>}
      <div role="status">
        {receipt && <p className="feedback success">Recibimos tu mensaje. Guarda la referencia <strong>{receipt}</strong>.</p>}
      </div>
      <form onSubmit={send} onReset={clearFeedback}>
        <fieldset disabled={busy} aria-busy={busy}>
          <legend className="visually-hidden">Datos del mensaje</legend>
          <Field name="contact-email" label="Correo electrónico" error={fields.email}>
            <input type="email" id="contact-email" name="email" autoComplete="email" maxLength={254} required
              aria-invalid={Boolean(fields.email)} aria-describedby="contact-email-hint" />
          </Field>
          <Field name="contact-topic" label="Motivo" error={fields.topic}>
            <select id="contact-topic" name="topic" defaultValue={recovery ? 'access' : 'application'}
              aria-invalid={Boolean(fields.topic)} aria-describedby="contact-topic-hint">
              <option value="application">Empadronamiento</option>
              <option value="access">Acceso a mi cuenta</option>
              <option value="other">Otra consulta</option>
            </select>
          </Field>
          <Field name="contact-message" label="Mensaje" error={fields.message} helper="Entre 10 y 1000 caracteres.">
            <textarea id="contact-message" name="message" rows={4} required minLength={10} maxLength={1000}
              aria-invalid={Boolean(fields.message)} aria-describedby="contact-message-hint" />
          </Field>
          <div className="contact-actions">
            <button className="button filled" type="submit">{busy ? 'Enviando…' : 'Enviar mensaje'}</button>
            <button className="button outline" type="reset">Limpiar</button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
