import type { Application, Fields } from './types';

export class ApiFailure extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: Fields = {},
    readonly application: Application | null = null,
  ) { super(message); }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
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
