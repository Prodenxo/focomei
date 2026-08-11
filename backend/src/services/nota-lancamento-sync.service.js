import { createSupabaseClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { query } from '../config/pg.js';
import { nfseStatusKeyParaLimite } from '../utils/meiLimitePayloadSum.js';
import {
  documentoFiscalLabel,
  extrairNomeClienteDaNota,
  extrairValorDaNota,
} from '../utils/notaFiscalDisplay.js';
import { createTransaction } from './transactions.service.js';

const TABLE = 'mei_nfse';
const inflightSyncByNota = new Map();

const isLocalAuthMode = () => env.AUTH_MODE === 'local';

const toObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

export const resolveLancamentoIdFromMetadata = (metadata) => {
  const meta = toObject(metadata);
  const raw = meta.lancamento_id ?? meta.lancamentoId;
  if (raw == null) return null;
  const id = String(raw).trim();
  return id || null;
};

const resolveClassificacaoEntrada = (documentType) => {
  const dt = String(documentType ?? '').trim().toUpperCase();
  if (dt === 'NFSE') return 'Freelance';
  return 'Outros (entrada)';
};

const resolveDataLancamento = (record) => {
  const created = record?.created_at;
  if (typeof created === 'string' && created.length >= 10) {
    return created.slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
};

/**
 * Monta obs/referência do lançamento vinculado à nota (usado na deduplicação).
 * @param {Record<string, unknown>} record
 */
export const buildLancamentoObsFromNota = (record) => {
  const cliente = extrairNomeClienteDaNota(record) || 'Cliente';
  const docLabel = documentoFiscalLabel(record.document_type);
  const referencia = record.protocol || record.id_integracao || record.plugnotas_id || record.id;
  const obs = `${docLabel} ${referencia} — ${cliente}`;
  return { obs, referencia: String(referencia ?? '').trim() };
};

const fetchNotaRow = async (userId, notaId) => {
  if (isLocalAuthMode()) {
    const { rows } = await query(
      `SELECT *
       FROM public.mei_nfse
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [notaId, userId],
    );
    return rows[0] || null;
  }

  const dbClient = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await dbClient
    .from(TABLE)
    .select('*')
    .eq('id', notaId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[nota-lancamento-sync] falha ao recarregar nota', {
      notaId,
      message: error.message,
    });
    return null;
  }

  return data || null;
};

const findExistingLancamentoId = async (userId, { obs, referencia }) => {
  if (!userId || !obs) return null;

  if (isLocalAuthMode()) {
    const { rows } = await query(
      `SELECT id
       FROM public.lancamentos_id
       WHERE user_id = $1
         AND (
           obs = $2
           OR ($3 <> '' AND obs ILIKE ('%' || $3 || '%'))
         )
       ORDER BY criado_em ASC NULLS LAST
       LIMIT 1`,
      [userId, obs, referencia || ''],
    );
    return rows[0]?.id ? String(rows[0].id) : null;
  }

  const dbClient = createSupabaseClient({ useServiceRole: true });
  let queryBuilder = dbClient
    .from('lancamentos_id')
    .select('id')
    .eq('user_id', userId)
    .eq('obs', obs)
    .order('criado_em', { ascending: true })
    .limit(1);

  const { data: exactMatch, error: exactError } = await queryBuilder.maybeSingle();
  if (exactError) {
    console.warn('[nota-lancamento-sync] falha ao buscar lançamento por obs', {
      message: exactError.message,
    });
    return null;
  }
  if (exactMatch?.id) return String(exactMatch.id);

  if (!referencia) return null;

  const { data: fuzzyMatch, error: fuzzyError } = await dbClient
    .from('lancamentos_id')
    .select('id')
    .eq('user_id', userId)
    .ilike('obs', `%${referencia}%`)
    .order('criado_em', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fuzzyError) {
    console.warn('[nota-lancamento-sync] falha ao buscar lançamento por referência', {
      message: fuzzyError.message,
    });
    return null;
  }

  return fuzzyMatch?.id ? String(fuzzyMatch.id) : null;
};

const acquireNotaSyncLock = async (notaId) => {
  const key = String(notaId);

  if (inflightSyncByNota.has(key)) {
    return {
      release: async () => {},
      waitFor: inflightSyncByNota.get(key),
    };
  }

  let releasePgLock = async () => {};
  try {
    if (env.DATABASE_URL || env.SUPABASE_DB_URL) {
      await query('SELECT pg_advisory_lock(hashtext($1))', [`nota-lancamento-sync:${key}`]);
      releasePgLock = async () => {
        await query('SELECT pg_advisory_unlock(hashtext($1))', [`nota-lancamento-sync:${key}`]);
      };
    }
  } catch (err) {
    console.warn('[nota-lancamento-sync] advisory lock indisponível', {
      notaId: key,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  let resolveDone;
  const donePromise = new Promise((resolve) => {
    resolveDone = resolve;
  });
  inflightSyncByNota.set(key, donePromise);

  return {
    release: async () => {
      try {
        await releasePgLock();
      } finally {
        inflightSyncByNota.delete(key);
        resolveDone?.();
      }
    },
    waitFor: null,
  };
};

const persistLancamentoLinkOnNota = async (userId, notaId, record, lancamentoId) => {
  const meta = toObject(record.metadata_json);
  const nextMeta = {
    ...meta,
    lancamento_id: lancamentoId,
    lancamentoSyncedAt: new Date().toISOString(),
  };

  if (isLocalAuthMode()) {
    const { rows } = await query(
      `UPDATE public.mei_nfse
       SET metadata_json = $1::jsonb,
           updated_at = now()
       WHERE id = $2
         AND user_id = $3
         AND COALESCE(metadata_json->>'lancamento_id', '') = ''
       RETURNING *`,
      [JSON.stringify(nextMeta), notaId, userId],
    );

    if (rows[0]) return rows[0];

    const refreshed = await fetchNotaRow(userId, notaId);
    return refreshed || { ...record, metadata_json: nextMeta };
  }

  const dbClient = createSupabaseClient({ useServiceRole: true });
  const { data: updatedRow, error } = await dbClient
    .from(TABLE)
    .update({
      metadata_json: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', notaId)
    .eq('user_id', userId)
    .is('metadata_json->>lancamento_id', null)
    .select()
    .maybeSingle();

  if (error) {
    console.warn('[nota-lancamento-sync] lançamento encontrado mas metadata não atualizada', {
      notaId,
      lancamentoId,
      message: error.message,
    });
    return { ...record, metadata_json: nextMeta };
  }

  if (updatedRow) return updatedRow;

  const refreshed = await fetchNotaRow(userId, notaId);
  return refreshed || { ...record, metadata_json: nextMeta };
};

const syncLancamentoFromNotaCore = async (userId, record) => {
  if (!userId || !record?.id) return record;

  const freshRecord = (await fetchNotaRow(userId, record.id)) || record;

  const statusKey = nfseStatusKeyParaLimite(freshRecord.status);
  if (statusKey !== 'concluido') return freshRecord;

  const existingLancamentoId = resolveLancamentoIdFromMetadata(freshRecord.metadata_json);
  if (existingLancamentoId) return freshRecord;

  const valor = extrairValorDaNota(freshRecord);
  if (valor === null || valor <= 0) return freshRecord;

  const { obs, referencia } = buildLancamentoObsFromNota(freshRecord);
  const classificacao = resolveClassificacaoEntrada(freshRecord.document_type);
  const data = resolveDataLancamento(freshRecord);

  const linkedLancamentoId = await findExistingLancamentoId(userId, { obs, referencia });
  if (linkedLancamentoId) {
    return persistLancamentoLinkOnNota(userId, freshRecord.id, freshRecord, linkedLancamentoId);
  }

  let lancamento;
  try {
    lancamento = await createTransaction(userId, {
      tipo: 'entrada',
      valor,
      classificacao,
      data,
      status: 'recebido',
      obs,
    });
  } catch (err) {
    console.warn('[nota-lancamento-sync] falha ao criar lançamento', {
      notaId: freshRecord.id,
      message: err instanceof Error ? err.message : String(err),
    });
    return freshRecord;
  }

  const lancamentoId = lancamento?.id ? String(lancamento.id) : null;
  if (!lancamentoId) return freshRecord;

  const updated = await persistLancamentoLinkOnNota(
    userId,
    freshRecord.id,
    freshRecord,
    lancamentoId,
  );

  const winnerId = resolveLancamentoIdFromMetadata(updated.metadata_json);
  if (winnerId && winnerId !== lancamentoId) {
    console.info('[nota-lancamento-sync] dedupe: outro processo vinculou lançamento primeiro', {
      notaId: freshRecord.id,
      orphanLancamentoId: lancamentoId,
      winnerLancamentoId: winnerId,
    });
  }

  return updated;
};

/**
 * Cria lançamento de entrada quando a nota fiscal conclui, com dedupe via metadata + obs/referência.
 * @param {string} userId
 * @param {Record<string, unknown>} record
 * @returns {Promise<Record<string, unknown>>}
 */
export const maybeSyncLancamentoFromNota = async (userId, record) => {
  if (!userId || !record?.id) return record;

  const lock = await acquireNotaSyncLock(record.id);
  if (lock.waitFor) {
    await lock.waitFor;
    return (await fetchNotaRow(userId, record.id)) || record;
  }

  try {
    return await syncLancamentoFromNotaCore(userId, record);
  } finally {
    await lock.release();
  }
};

/**
 * Sincroniza lançamentos em background para notas concluídas sem vínculo.
 * @param {string} userId
 * @param {Array<Record<string, unknown>>} rows
 */
export const syncLancamentosForNotasInBackground = (userId, rows = []) => {
  const pending = (rows || []).filter((row) => {
    if (!row?.id) return false;
    if (nfseStatusKeyParaLimite(row.status) !== 'concluido') return false;
    return !resolveLancamentoIdFromMetadata(row.metadata_json);
  }).slice(0, 25);

  if (!pending.length) return;

  void Promise.allSettled(
    pending.map((row) => maybeSyncLancamentoFromNota(userId, row)),
  ).then((results) => {
    const failed = results.filter((result) => result.status === 'rejected');
    if (!failed.length) return;
    console.warn('[nota-lancamento-sync] sync em lote falhou parcialmente', {
      failed: failed.length,
    });
  });
};
