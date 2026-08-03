import { createSupabaseClient } from '../config/supabase.js';
import { nfseStatusKeyParaLimite } from '../utils/meiLimitePayloadSum.js';
import {
  documentoFiscalLabel,
  extrairNomeClienteDaNota,
  extrairValorDaNota,
} from '../utils/notaFiscalDisplay.js';
import { createTransaction } from './transactions.service.js';

const TABLE = 'mei_nfse';

const toObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

const resolveLancamentoIdFromMetadata = (metadata) => {
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
 * Cria lançamento de entrada quando a nota fiscal conclui, com dedupe via metadata_json.lancamento_id.
 * @param {string} userId
 * @param {Record<string, unknown>} record
 * @returns {Promise<Record<string, unknown>>}
 */
export const maybeSyncLancamentoFromNota = async (userId, record) => {
  if (!userId || !record?.id) return record;

  const statusKey = nfseStatusKeyParaLimite(record.status);
  if (statusKey !== 'concluido') return record;

  const existingLancamentoId = resolveLancamentoIdFromMetadata(record.metadata_json);
  if (existingLancamentoId) return record;

  const valor = extrairValorDaNota(record);
  if (valor === null || valor <= 0) return record;

  const cliente = extrairNomeClienteDaNota(record) || 'Cliente';
  const docLabel = documentoFiscalLabel(record.document_type);
  const referencia = record.protocol || record.id_integracao || record.plugnotas_id || record.id;
  const classificacao = resolveClassificacaoEntrada(record.document_type);
  const data = resolveDataLancamento(record);
  const obs = `${docLabel} ${referencia} — ${cliente}`;

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
      notaId: record.id,
      message: err instanceof Error ? err.message : String(err),
    });
    return record;
  }

  const lancamentoId = lancamento?.id;
  if (!lancamentoId) return record;

  const meta = toObject(record.metadata_json);
  const nextMeta = {
    ...meta,
    lancamento_id: lancamentoId,
    lancamentoSyncedAt: new Date().toISOString(),
  };

  const dbClient = createSupabaseClient({ useServiceRole: true });
  const { data: updatedRow, error } = await dbClient
    .from(TABLE)
    .update({
      metadata_json: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', record.id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.warn('[nota-lancamento-sync] lançamento criado mas metadata não atualizada', {
      notaId: record.id,
      lancamentoId,
      message: error.message,
    });
    return { ...record, metadata_json: nextMeta };
  }

  return updatedRow || { ...record, metadata_json: nextMeta };
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

  void Promise.all(
    pending.map((row) => maybeSyncLancamentoFromNota(userId, row)),
  ).catch((err) => {
    console.warn('[nota-lancamento-sync] sync em lote falhou', {
      message: err instanceof Error ? err.message : String(err),
    });
  });
};
