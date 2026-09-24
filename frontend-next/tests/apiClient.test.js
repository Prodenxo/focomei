import test from 'node:test';
import assert from 'node:assert/strict';
import { apiClient as compatibilityClient } from '../lib/api.js';
import {
  apiClient,
  isAbortError,
  NotAuthenticatedError,
} from '../lib/apiClient.js';

function installBrowserStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  global.window = {
    location: { hostname: 'localhost' },
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  };
}

test('o caminho antigo e o atual usam o mesmo cliente HTTP', () => {
  assert.equal(compatibilityClient, apiClient);
});

test('cliente aceita a sessão Supabase gravada pelo site anterior', async (t) => {
  installBrowserStorage({
    'financas-pessoais-auth': JSON.stringify({
      access_token: 'token-supabase',
      user: { id: 'user-1' },
    }),
  });

  const previousFetch = global.fetch;
  t.after(() => {
    global.fetch = previousFetch;
    delete global.window;
  });

  global.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer token-supabase');
    return new Response(JSON.stringify({ success: true, data: { ok: true } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  assert.deepEqual(await apiClient.get('/auth/session'), { ok: true });
});

test('requisição protegida sem sessão falha antes de chamar a rede', async (t) => {
  installBrowserStorage();
  t.after(() => delete global.window);

  await assert.rejects(
    () => apiClient.get('/auth/session'),
    (error) => error instanceof NotAuthenticatedError && error.status === 401,
  );
});

test('cancelamento externo continua sendo AbortError', async (t) => {
  installBrowserStorage({
    'focomei-local-auth': JSON.stringify({
      accessToken: 'token-local',
      user: { id: 'user-1' },
    }),
  });
  const previousFetch = global.fetch;
  t.after(() => {
    global.fetch = previousFetch;
    delete global.window;
  });

  global.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    const rejectAbort = () => reject(new DOMException('Cancelada', 'AbortError'));
    if (options.signal.aborted) {
      rejectAbort();
      return;
    }
    options.signal.addEventListener('abort', rejectAbort, { once: true });
  });

  const controller = new AbortController();
  const request = apiClient.get('/transactions', { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, (error) => isAbortError(error));
});
