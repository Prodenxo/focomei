import crypto from 'node:crypto';
import { createSupabaseClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { query } from '../config/pg.js';

const TABLE = 'mei_nfse';
const DEFAULT_WINDOW_MS = 30 * 60 * 1000;
const inflightByKey = new Map();

const isLocalAuthMode = () => env.AUTH_MODE === 'local';

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

const normalizeName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');

const roundMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
};

const hashFingerprint = (fingerprint) =>
  crypto.createHash('sha256').update(String(fingerprint)).digest('hex').slice(0, 32);

/**
 * @param {object} payload
 * @param {object} input
 */
export const buildOpenclawNfseEmitFingerprint = (payload = {}, input = {}) => {
  const doc = normalizeDoc(
    input.tomadorCpfCnpj
      || payload.tomadorCpfCnpj
      || payload.tomadorDocumento
      || payload.documento,
  );
  const nome = normalizeName(
    payload.tomadorNome
      || input.tomadorRazaoSocial
      || payload.cliente
      || payload.clienteNome,
  );
  const valor = roundMoney(
    input.servico?.valorServico
      ?? payload.valorServico
      ?? payload.valor
      ?? payload.valorReais,
  );
  const servicoKey = normalizeName(
    input.servico?.codigo
      || payload.codigoServico
      || payload.servicoCodigo
      || (payload.servicoIndice != null ? `idx:${payload.servicoIndice}` : '')
      || input.servico?.discriminacao
      || payload.discriminacao
      || payload.servicoNome,
  );
  return `NFSE|${doc || nome}|${valor}|${servicoKey}`;
};

/**
 * @param {object} payload
 * @param {object} input
 */
export const buildOpenclawNfeEmitFingerprint = (payload = {}, input = {}) => {
  const item = input.itens?.[0] || {};
  const doc = normalizeDoc(
    input.destinatario?.cpfCnpj
      || payload.destinatarioCpfCnpj
      || payload.destinatarioDocumento
      || payload.documento,
  );
  const nome = normalizeName(
    payload.destinatarioNome
      || input.destinatario?.razaoSocial
      || payload.cliente
      || payload.clienteNome,
  );
  const valor = roundMoney(item.valor ?? payload.valor ?? payload.valorTotal);
  const produto = normalizeName(
    payload.produtoNome
      || item.descricao
      || payload.produto
      || payload.item,
  );
  return `NFE|${doc || nome}|${valor}|${produto}`;
};

const isReplayableEmitStatus = (status) => {
  const s = String(status || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (s.includes('rejeit')) return false;
  return (
    s === 'concluido'
    || s === 'concluida'
    || s === 'processando'
    || s.includes('autoriz')
    || s.includes('process')
  );
};

/** @param {string} status */
export const shouldReplayOpenclawEmitNota = (status) => isReplayableEmitStatus(status);

const pickBestExistingNota = (rows = []) => {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!list.length) return null;

  const score = (row) => {
    const s = String(row.status || '').toLowerCase();
    if (s.includes('conclu')) return 300;
    if (s.includes('process')) return 200;
    if (s.includes('rejeit')) return 100;
    return 0;
  };

  return [...list].sort((a, b) => {
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  })[0];
};

const queryRecentByFingerprintLocal = async (userId, fingerprint, documentType, sinceIso) => {
  const { rows } = await query(
    `SELECT *
     FROM public.mei_nfse
     WHERE user_id = $1
       AND document_type = $2
       AND created_at >= $3::timestamptz
       AND metadata_json->>'openclawEmitFingerprint' = $4
     ORDER BY created_at DESC
     LIMIT 5`,
    [userId, documentType, sinceIso, fingerprint],
  );
  return pickBestExistingNota(rows);
};

const queryRecentByFingerprintSupabase = async (userId, fingerprint, documentType, sinceIso) => {
  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('document_type', documentType)
    .eq('metadata_json->>openclawEmitFingerprint', fingerprint)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) {
    console.warn('[openclaw-nf-emit-idempotency] falha ao buscar fingerprint', {
      message: error.message,
    });
    return null;
  }
  return pickBestExistingNota(data);
};

const queryRecentFallbackLocal = async (userId, documentType, sinceIso, tomadorDoc, valor) => {
  if (!tomadorDoc || !valor) return null;
  const { rows } = await query(
    `SELECT *
     FROM public.mei_nfse
     WHERE user_id = $1
       AND document_type = $2
       AND created_at >= $3::timestamptz
       AND cnpj_tomador = $4
       AND (
         (payload_json->'servico'->0->'valor'->>'servico')::numeric = $5::numeric
         OR (payload_json->'servico'->'valor'->>'servico')::numeric = $5::numeric
         OR (payload_json->'pagamentos'->0->>'valor')::numeric = $5::numeric
       )
     ORDER BY created_at DESC
     LIMIT 5`,
    [userId, documentType, sinceIso, tomadorDoc, valor],
  );
  return pickBestExistingNota(rows);
};

/**
 * @param {string} userId
 * @param {string} fingerprint
 * @param {'NFSE'|'NFE'} documentType
 * @param {{ forceRetry?: boolean, windowMs?: number, tomadorDoc?: string, valor?: number|string }} [opts]
 */
export const findRecentOpenclawEmitNota = async (
  userId,
  fingerprint,
  documentType,
  opts = {},
) => {
  if (!userId || !fingerprint) return null;
  if (opts.forceRetry === true) return null;

  const windowMs = Number(opts.windowMs) > 0 ? Number(opts.windowMs) : DEFAULT_WINDOW_MS;
  const sinceIso = new Date(Date.now() - windowMs).toISOString();

  let row = isLocalAuthMode()
    ? await queryRecentByFingerprintLocal(userId, fingerprint, documentType, sinceIso)
    : await queryRecentByFingerprintSupabase(userId, fingerprint, documentType, sinceIso);

  if (!row && opts.tomadorDoc && opts.valor != null) {
    row = await queryRecentFallbackLocal(
      userId,
      documentType,
      sinceIso,
      normalizeDoc(opts.tomadorDoc),
      roundMoney(opts.valor),
    );
  }

  if (!row || !isReplayableEmitStatus(row.status)) return null;
  return row;
};

const acquireEmitLock = async (userId, fingerprint) => {
  const key = `${userId}:${hashFingerprint(fingerprint)}`;

  if (inflightByKey.has(key)) {
    return {
      waitFor: inflightByKey.get(key),
      release: async () => {},
    };
  }

  let releasePg = async () => {};
  try {
    if (env.DATABASE_URL || env.SUPABASE_DB_URL) {
      await query('SELECT pg_advisory_lock(hashtext($1))', [`openclaw-emit:${key}`]);
      releasePg = async () => {
        await query('SELECT pg_advisory_unlock(hashtext($1))', [`openclaw-emit:${key}`]);
      };
    }
  } catch (err) {
    console.warn('[openclaw-nf-emit-idempotency] advisory lock indisponível', {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  let resolveDone;
  const donePromise = new Promise((resolve) => {
    resolveDone = resolve;
  });
  inflightByKey.set(key, donePromise);

  return {
    waitFor: null,
    release: async () => {
      try {
        await releasePg();
      } finally {
        inflightByKey.delete(key);
        resolveDone?.();
      }
    },
  };
};

/**
 * Serializa emissões OpenClaw com a mesma fingerprint e evita duplicata em paralelo.
 * @template T
 * @param {string} userId
 * @param {string} fingerprint
 * @param {() => Promise<T>} task
 */
export const withOpenclawEmitIdempotency = async (userId, fingerprint, task) => {
  const lock = await acquireEmitLock(userId, fingerprint);
  if (lock.waitFor) {
    await lock.waitFor;
    return null;
  }

  try {
    return await task();
  } finally {
    await lock.release();
  }
};

export const stampOpenclawEmitMetadata = (metadata = {}, fingerprint) => ({
  ...(metadata && typeof metadata === 'object' ? metadata : {}),
  source: metadata?.source || 'openclaw_whatsapp',
  openclawEmitFingerprint: fingerprint,
  openclawEmitAt: new Date().toISOString(),
});
