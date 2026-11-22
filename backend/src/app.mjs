import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import express from 'express';
import { rateLimit } from 'express-rate-limit';

const deriveKey = promisify(scrypt);
const sessionMs = 8 * 60 * 60 * 1000;
const cookieName = 'mercaorden_session';
const maxFileSize = 2 * 1024 * 1024;
const categories = ['Frutas', 'Verduras', 'Tubérculos', 'Abarrotes', 'Otros alimentos'];
const contactTopics = ['application', 'access', 'other'];
const digest = (value) => createHash('sha256').update(value).digest('hex');

const fileTypes = {
  'application/pdf': { extension: 'pdf', matches: (bytes) => bytes.subarray(0, 5).equals(Buffer.from('%PDF-')) },
  'image/jpeg': { extension: 'jpg', matches: (bytes) => bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9 },
  'image/png': { extension: 'png', matches: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
};

class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    Object.assign(this, { status, code, fields });
  }
}

function readEmail(body) {
  return typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
}

function validEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function credentials(body, signup) {
  const email = readEmail(body);
  const password = typeof body?.password === 'string' ? body.password : '';
  const fields = {};
  if (!validEmail(email)) fields.email = 'Ingresa un correo electrónico válido.';
  if (!password || password.length > 128 || (signup && password.length < 10)) {
    fields.password = signup ? 'Usa entre 10 y 128 caracteres.' : 'Ingresa tu contraseña.';
  }
  if (Object.keys(fields).length) throw new ApiError(400, 'INVALID_FIELDS', 'Revisa los campos marcados.', fields);
  return { email, password };
}

function contactDetails(body) {
  const email = readEmail(body);
  const topic = body?.topic;
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const fields = {};
  if (!validEmail(email)) fields.email = 'Ingresa un correo electrónico válido.';
  if (!contactTopics.includes(topic)) fields.topic = 'Selecciona un motivo de consulta.';
  if (message.length < 10 || message.length > 1000) fields.message = 'Escribe entre 10 y 1000 caracteres.';
  if (Object.keys(fields).length) throw new ApiError(400, 'INVALID_FIELDS', 'Revisa los campos marcados.', fields);
  return { email, topic, message };
}

async function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  const hash = await deriveKey(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}

function sessionToken(req) {
  return req.headers.cookie?.match(/(?:^|;\s*)mercaorden_session=([0-9a-f]{64})(?:;|$)/)?.[1];
}

async function applicationForm(req) {
  if (!Buffer.isBuffer(req.body)) throw new ApiError(415, 'UNSUPPORTED_FORM', 'Envía el formulario con sus documentos adjuntos.');
  let form;
  try {
    form = await new Request('http://localhost', {
      method: 'POST', headers: { 'Content-Type': req.get('Content-Type') }, body: new Uint8Array(req.body),
    }).formData();
  } catch {
    throw new ApiError(400, 'INVALID_FORM', 'Vuelve a seleccionar los documentos y envía el formulario.');
  }

  const read = (key) => typeof form.get(key) === 'string' ? form.get(key).trim() : '';
  const name = read('name').normalize('NFC').replace(/\s+/g, ' ');
  const documentType = read('documentType').toUpperCase();
  const document = read('document').replace(/[\s.-]/g, '');
  const category = read('category');
  const fields = {};
  if (name.length < 3 || name.length > 120) fields.name = 'Ingresa tus nombres y apellidos, entre 3 y 120 caracteres.';
  const validDocument = documentType === 'DNI' ? /^\d{8}$/.test(document) : documentType === 'CE' && /^\d{9,12}$/.test(document);
  if (!validDocument) fields.document = 'Ingresa 8 dígitos para el DNI o entre 9 y 12 para el carné de extranjería.';
  if (!categories.includes(category)) fields.category = 'Selecciona el rubro de tu negocio.';
  const attachments = [];

  for (const kind of ['identity', 'support']) {
    const file = form.get(kind);
    if (!(file instanceof File) || form.getAll(kind).length !== 1 || !file.size || file.size > maxFileSize || !Object.hasOwn(fileTypes, file.type)) {
      fields[kind] = 'Adjunta un PDF, JPG o PNG de hasta 2 MB.';
      continue;
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!fileTypes[file.type].matches(bytes)) {
      fields[kind] = 'El contenido del archivo no corresponde a su formato.';
      continue;
    }
    attachments.push({ kind, mime: file.type, bytes });
  }

  if (Object.keys(fields).length) throw new ApiError(400, 'INVALID_FIELDS', 'Revisa los campos y adjuntos marcados.', fields);
  return { data: { name, documentType, document, category }, attachments };
}

export function createApp(store, { origin = 'http://localhost:3000' } = {}) {
  const app = express();
  const browserOrigin = new URL(origin).origin;
  const cookieOptions = { path: '/', httpOnly: true, sameSite: 'strict', secure: browserOrigin.startsWith('https:') };
  const dummyHash = `${randomBytes(16).toString('hex')}:${randomBytes(64).toString('hex')}`;
  app.disable('x-powered-by');
  app.use('/api', (req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    const requestOrigin = req.get('Origin');
    if (!['GET', 'HEAD'].includes(req.method) && ((requestOrigin && requestOrigin !== browserOrigin) || req.get('Sec-Fetch-Site') === 'cross-site')) {
      return next(new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Abre el formulario desde MercaOrden.'));
    }
    next();
  });

  const authLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new ApiError(429, 'TOO_MANY_REQUESTS', 'Espera un minuto antes de volver a intentarlo.')) });
  const contactLimit = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new ApiError(429, 'TOO_MANY_REQUESTS', 'Espera un minuto antes de volver a enviar tu mensaje.')) });
  const json = express.json({ limit: '8kb' });
  const requireUser = (req, _res, next) => {
    const token = sessionToken(req);
    const user = token && store.getSession(digest(token), Date.now());
    if (!user) return next(new ApiError(401, 'SIGN_IN_REQUIRED', 'Inicia sesión para continuar.'));
    req.user = user;
    next();
  };

  function setSession(req, res, user, status) {
    const oldToken = sessionToken(req);
    if (oldToken) store.deleteSession(digest(oldToken));
    const token = randomBytes(32).toString('hex');
    const now = Date.now();
    store.createSession(digest(token), user.id, now, now + sessionMs);
    res.cookie(cookieName, token, { ...cookieOptions, maxAge: sessionMs }).status(status).json({ user });
  }

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.post('/api/contact', contactLimit, json, (req, res) => {
    const details = contactDetails(req.body);
    res.status(201).json({ reference: store.createContact(details) });
  });
  app.post('/api/session/signup', authLimit, json, async (req, res) => {
    const { email, password } = credentials(req.body, true);
    const user = store.createAccount(email, await passwordHash(password));
    if (!user) throw new ApiError(409, 'EMAIL_IN_USE', 'El correo ya tiene una cuenta. Inicia sesión.');
    setSession(req, res, user, 201);
  });
  app.post('/api/session/login', authLimit, json, async (req, res) => {
    const { email, password } = credentials(req.body, false);
    const account = store.findAccount(email);
    const expected = account?.password_hash ?? dummyHash;
    const actual = await passwordHash(password, expected.split(':')[0]);
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(actual)) || !account) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'El correo o la contraseña no coinciden.');
    }
    setSession(req, res, { id: account.id, email: account.email, role: account.role }, 200);
  });
  app.get('/api/session', requireUser, (req, res) => res.json({ user: req.user }));
  app.delete('/api/session', (req, res) => {
    const token = sessionToken(req);
    if (token) store.deleteSession(digest(token));
    res.clearCookie(cookieName, cookieOptions).status(204).end();
  });

  app.get('/api/applications', requireUser, (req, res) => res.json({ applications: store.listApplications(req.user.id) }));
  app.post('/api/applications', requireUser, express.raw({ type: 'multipart/form-data', limit: '5mb' }), async (req, res) => {
    if (req.user.role !== 'merchant') throw new ApiError(403, 'MERCHANT_REQUIRED', 'Solo los comerciantes pueden iniciar una solicitud.');
    const { data, attachments } = await applicationForm(req);
    const result = store.createApplication(req.user.id, data, attachments);
    if (result.duplicate) {
      const message = result.application
        ? 'Ya tienes una solicitud activa. Puedes consultarla con el código original.'
        : 'Ya existe una solicitud activa para ese documento. Inicia sesión con la cuenta original o consulta con la administración del mercado.';
      return res.status(409).json({ error: { code: 'ACTIVE_APPLICATION', message }, application: result.application });
    }
    res.status(201).json({ application: result.application });
  });
  app.get('/api/applications/:code', requireUser, (req, res) => {
    const application = store.findApplication(req.params.code.toUpperCase(), req.user);
    if (!application) throw new ApiError(404, 'NOT_FOUND', 'No encontramos ese expediente en tu cuenta.');
    res.json({ application });
  });
  app.post('/api/applications/:code/decision', requireUser, json, (req, res) => {
    if (req.user.role !== 'staff') throw new ApiError(403, 'EVALUATOR_REQUIRED', 'Solo el evaluador municipal puede resolver solicitudes.');
    const { decision, reviewed } = req.body ?? {};
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (decision !== 'approved' && decision !== 'observed') {
      throw new ApiError(400, 'INVALID_FIELDS', 'Selecciona Aprobar u Observar.', { decision: 'Selecciona una decisión.' });
    }
    if (decision === 'approved' && reviewed !== true) {
      throw new ApiError(400, 'INVALID_FIELDS', 'Confirma la revisión de los requisitos.', { reviewed: 'Confirma que los documentos cumplen los requisitos.' });
    }
    if (decision === 'observed' && (!reason || reason.length > 1000)) {
      throw new ApiError(400, 'INVALID_FIELDS', 'Indica qué debe corregir el comerciante.', { reason: 'Escribe un motivo de hasta 1000 caracteres.' });
    }
    const { application, resolved } = store.resolveApplication(req.params.code.toUpperCase(), req.user, decision, decision === 'observed' ? reason : null);
    if (!application) throw new ApiError(404, 'NOT_FOUND', 'No encontramos ese expediente.');
    if (!resolved) throw new ApiError(409, 'ALREADY_RESOLVED', 'Este expediente ya fue resuelto. Recarga su estado para ver la decisión.');
    res.json({ application });
  });
  app.get('/api/applications/:code/attachments/:kind', requireUser, (req, res) => {
    const attachment = store.findAttachment(req.params.code.toUpperCase(), req.params.kind, req.user);
    if (!attachment) throw new ApiError(404, 'NOT_FOUND', 'No encontramos ese documento en tu cuenta.');
    res.attachment(`${req.params.kind === 'identity' ? 'identidad' : 'sustento'}.${fileTypes[attachment.mime].extension}`)
      .type(attachment.mime).send(Buffer.from(attachment.bytes));
  });

  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'No encontramos el recurso solicitado.')));
  app.use((error, _req, res, _next) => {
    if (error instanceof ApiError) {
      return res.status(error.status).json({ error: { code: error.code, message: error.message, fields: error.fields } });
    }
    if (error.type === 'entity.too.large') {
      const message = _req.is('multipart/form-data')
        ? 'Reduce el tamaño de los documentos a 2 MB por archivo.'
        : 'Reduce el tamaño de los datos enviados y vuelve a intentarlo.';
      return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message } });
    }
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'INVALID_BODY', message: 'Revisa los datos enviados.' } });
    console.error('Error interno en la API', error.code ?? error.name);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'No pudimos completar la operación. Inténtalo de nuevo.' } });
  });
  return app;
}
