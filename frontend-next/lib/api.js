import { getApiBaseUrl } from '@/lib/env';
import { readAccessToken } from '@/lib/session';

/**
 * Porte de `frontend/lib/apiClient.ts`: mesmo contrato `{ success, data, message }`,
 * mesmo Bearer e mesmo tratamento de erro/304.
 */

export class ApiError extends Error {
  constructor(message, { code, status } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export class NotAuthenticatedError extends ApiError {
  constructor() {
    super('Sessão não encontrada. Faça login no FocoMEI.', { code: 'sem_sessao' });
    this.name = 'NotAuthenticatedError';
  }
}

const normalizePath = (path) => (path.startsWith('/') ? path : `/${path}`);

const getBaseUrl = () => {
  const apiUrl = getApiBaseUrl();
  if (!apiUrl) {
    throw new ApiError('API não configurada. Defina NEXT_PUBLIC_MEI_API_URL.');
  }
  return `${apiUrl}/api`;
};

const resolveErrorMessage = (payload, statusText, fallback = 'Falha na requisição.') => {
  const message = String(payload?.message ?? '').trim();
  return message || statusText?.trim() || fallback;
};

const readErrorCode = (errors) => {
  if (errors && typeof errors === 'object' && 'code' in errors) {
    return errors.code ? String(errors.code) : undefined;
  }
  return undefined;
};

async function requestJson(path, { method = 'GET', body, signal } = {}) {
  const token = readAccessToken();
  if (!token) throw new NotAuthenticatedError();

  const response = await fetch(`${getBaseUrl()}${normalizePath(path)}`, {
    method,
    signal,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 304) {
    throw new ApiError(
      'Resposta em cache desatualizada (304). Atualize a página e tente de novo.',
      { status: 304 },
    );
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const payload = await response.json();
    if (!response.ok || payload?.success === false) {
      throw new ApiError(resolveErrorMessage(payload, response.statusText), {
        code: readErrorCode(payload?.errors),
        status: response.status,
      });
    }
    return payload?.data;
  }

  const text = await response.text();
  if (!response.ok) {
    throw new ApiError(text || response.statusText || 'Falha na requisição.', {
      status: response.status,
    });
  }
  return text;
}

export const apiClient = {
  get: (path, options) => requestJson(path, { ...options, method: 'GET' }),
  post: (path, body, options) => requestJson(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => requestJson(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => requestJson(path, { ...options, method: 'DELETE' }),
};

/** `AbortError` não é falha de verdade — é troca de filtro. */
export function isAbortError(error) {
  return error?.name === 'AbortError';
}
