import { getApiBaseUrl } from './env.js';
import { neutralizeProviderNames } from './providerNeutralText.js';
import { readAccessToken } from './session.js';

const DEFAULT_FETCH_TIMEOUT_MS = 8000;
/** Emissão fiscal (Plugnotas + validações) pode levar dezenas de segundos. */
export const EMIT_FETCH_TIMEOUT_MS = 120000;

const normalizePath = (path) => (path.startsWith('/') ? path : `/${path}`);

export class ApiError extends Error {
  constructor(message, { code, status, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class NotAuthenticatedError extends ApiError {
  constructor() {
    super('Sessão não encontrada. Faça login no FocoMEI.', {
      code: 'sem_sessao',
      status: 401,
    });
    this.name = 'NotAuthenticatedError';
  }
}

/** `AbortError` externo é troca de filtro/navegação, não falha da API. */
export function isAbortError(error) {
  return error?.name === 'AbortError';
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const externalSignal = options.signal;
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener('abort', abortFromExternal, { once: true });
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      if (externalSignal?.aborted) throw error;
      throw new ApiError('Tempo esgotado ao conectar ao servidor.', {
        code: 'timeout',
      });
    }
    const message = error instanceof Error ? error.message : 'Falha na requisição.';
    throw new ApiError(
      message.includes('fetch') ? 'Não foi possível conectar ao servidor.' : message,
      { code: 'network_error' },
    );
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}

const getBaseUrl = () => {
  const apiUrl = getApiBaseUrl();
  if (!apiUrl) {
    throw new ApiError(
      'API não configurada. Defina NEXT_PUBLIC_API_URL (ou NEXT_PUBLIC_API_URL_DEV em localhost).',
      { code: 'api_not_configured' },
    );
  }
  return `${apiUrl}/api`;
};

const resolveApiErrorMessage = (payload, statusText, fallback = 'Falha na requisição.') => {
  const message = String(payload?.message ?? '').trim();
  return neutralizeProviderNames(message || statusText?.trim() || fallback);
};

const createApiError = (message, response, payload) => {
  return new ApiError(message, {
    status: response?.status,
    code:
      payload?.code
      || payload?.error?.code
      || payload?.errors?.code,
    details: payload?.details || payload?.error?.details,
  });
};

async function buildAuthHeaders(extra) {
  const token = readAccessToken();
  if (!token) throw new NotAuthenticatedError();
  return {
    Authorization: `Bearer ${token}`,
    ...(extra || {}),
  };
}

async function requestJson(path, options = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const url = `${getBaseUrl()}${normalizePath(path)}`;
  const headers = await buildAuthHeaders(
    options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : undefined,
  );

  let response;
  try {
    response = await fetchWithTimeout(url, {
      ...options,
      cache: 'no-store',
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    }, timeoutMs);
  } catch (error) {
    throw error instanceof Error ? error : new Error('Falha na requisição.');
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const payload = await response.json();
    if (!response.ok || payload?.success === false) {
      throw createApiError(resolveApiErrorMessage(payload, response.statusText), response, payload);
    }
    if (payload != null && Object.prototype.hasOwnProperty.call(payload, 'data')) {
      const unwrapped = payload.data;
      if (typeof unwrapped === 'boolean') return null;
      return unwrapped;
    }
    return payload;
  }

  const text = await response.text();
  if (!response.ok) {
    throw createApiError(
      neutralizeProviderNames(text || response.statusText || 'Falha na requisição.'),
      response,
    );
  }
  return text;
}

async function downloadBinary(path, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const url = `${getBaseUrl()}${normalizePath(path)}`;
  const headers = await buildAuthHeaders();

  let response;
  try {
    response = await fetchWithTimeout(url, {
      method: 'GET',
      cache: 'no-store',
      headers,
    }, timeoutMs);
  } catch (error) {
    throw error instanceof Error ? error : new Error('Falha no download.');
  }

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const payload = await response.json();
      throw new Error(resolveApiErrorMessage(payload, response.statusText, 'Falha no download.'));
    }
    throw new Error(neutralizeProviderNames(response.statusText || 'Falha no download.'));
  }

  return response.blob();
}

async function requestJsonPublic(path, options = {}) {
  const url = `${getBaseUrl()}${normalizePath(path)}`;
  const response = await fetchWithTimeout(url, {
    ...options,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const payload = await response.json();
    if (!response.ok || payload?.success === false) {
      throw new Error(resolveApiErrorMessage(payload, response.statusText));
    }
    if (payload != null && Object.prototype.hasOwnProperty.call(payload, 'data')) {
      const unwrapped = payload.data;
      if (typeof unwrapped === 'boolean') return null;
      return unwrapped;
    }
    return payload;
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(neutralizeProviderNames(text || response.statusText || 'Falha na requisição.'));
  }
  return text;
}

export const apiClient = {
  get: (path, { timeoutMs, signal } = {}) =>
    requestJson(path, { method: 'GET', signal }, timeoutMs),
  post: (path, body, { timeoutMs, signal } = {}) =>
    requestJson(path, {
      method: 'POST',
      signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }, timeoutMs),
  postForm: (path, formData, { timeoutMs, signal } = {}) =>
    requestJson(path, {
      method: 'POST',
      signal,
      body: formData,
    }, timeoutMs),
  getPublic: (path) => requestJsonPublic(path, { method: 'GET' }),
  postPublic: (path, body) =>
    requestJsonPublic(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: (path, body, { timeoutMs, signal } = {}) =>
    requestJson(path, {
      method: 'PUT',
      signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }, timeoutMs),
  patch: (path, body, { timeoutMs, signal } = {}) =>
    requestJson(path, {
      method: 'PATCH',
      signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }, timeoutMs),
  delete: (path, { timeoutMs, signal } = {}) =>
    requestJson(path, { method: 'DELETE', signal }, timeoutMs),
  download: (path, { timeoutMs } = {}) => downloadBinary(path, timeoutMs),
};
