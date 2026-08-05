import crypto from 'node:crypto';
import { createSupabaseClient } from '../config/supabase.js';
import { badRequest } from '../utils/errors.js';
import { consultarNfsePorPeriodo } from './plugnotas/nfse.service.js';
import { collectPeriodoNotas } from './plugnotas/plugnotas-empresa-rps-heal.js';
import { getCertificateDocument, getEmitenteNfseSnapshot } from './mei-certificate-store.js';
import {
  extractPlugNotasId,
  extractIntegracaoId,
  extractPlugNotasStatus,
} from './mei-notas.service.js';

const TABLE = 'mei_nfse';
const CLIENTS_TABLE = 'mei_nfse_clientes';
const DOCUMENT_TYPE_NFSE = 'NFSE';
const PROVIDER_PLUGNOTAS = 'plugnotas';
const DEFAULT_MAX_PAGES = 40;
const DEFAULT_LOOKBACK_DAYS = 365 * 5;
/** PlugNotas rejeita intervalo maior que 31 dias em `/nfse/consultar/periodo`. */
const PLUGNOTAS_MAX_WINDOW_DAYS = 31;

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

const parseIsoDate = (value) => {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(`${text}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatIsoDate = (date) => date.toISOString().slice(0, 10);

/** Quebra intervalo em janelas de até 31 dias (mais recente primeiro). */
export const buildPlugnotasPeriodoWindows = (
  dataInicial,
  dataFinal,
  maxWindowDays = PLUGNOTAS_MAX_WINDOW_DAYS,
) => {
  const start = parseIsoDate(dataInicial);
  const end = parseIsoDate(dataFinal);
  if (!start || !end || start > end) return [];

  const windows = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    const windowEnd = new Date(cursor);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + maxWindowDays - 1);
    if (windowEnd > end) windowEnd.setTime(end.getTime());
    windows.push({
      dataInicial: formatIsoDate(cursor),
      dataFinal: formatIsoDate(windowEnd),
    });
    cursor = new Date(windowEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return windows.reverse();
};

const getDb = () => createSupabaseClient({ useServiceRole: true });

const extractProtocol = (response) => {
  if (!response || typeof response !== 'object') return null;
  const protocol = response.protocol ?? response.protocolo;
  return protocol ? String(protocol).trim() : null;
};

const clampMaxPages = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_MAX_PAGES;
  return Math.min(Math.max(Math.trunc(n), 1), 200);
};

const resolveDefaultPeriodo = () => {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - DEFAULT_LOOKBACK_DAYS);
  return {
    dataInicial: start.toISOString().slice(0, 10),
    dataFinal: end.toISOString().slice(0, 10),
  };
};

const resolvePrestadorCnpj = async (userId, cnpjHint) => {
  const fromHint = normalizeDoc(cnpjHint);
  if (fromHint.length === 14) return fromHint;

  try {
    const snap = await getEmitenteNfseSnapshot(userId);
    const fromSnap = normalizeDoc(snap?.cnpj || snap?.cpfCnpj);
    if (fromSnap.length === 14) return fromSnap;
  } catch {
    /* ignora */
  }

  try {
    const doc = await getCertificateDocument(userId);
    const fromCert = normalizeDoc(doc);
    if (fromCert.length === 14) return fromCert;
  } catch {
    /* ignora */
  }

  throw badRequest(
    'CNPJ do prestador não identificado. Cadastre o certificado MEI na aba Certificado.',
  );
};

const buildImportDedupeKey = (nota) => {
  const idIntegracao = extractIntegracaoId(nota);
  if (idIntegracao) return { kind: 'id_integracao', value: String(idIntegracao).trim() };

  const plugId = extractPlugNotasId(nota);
  if (plugId) return { kind: 'plugnotas_id', value: String(plugId).trim() };

  const protocol = extractProtocol(nota);
  if (protocol) return { kind: 'protocol', value: protocol };

  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(nota))
    .digest('hex')
    .slice(0, 24);
  return { kind: 'id_integracao', value: `import:${hash}` };
};

const resolveIdIntegracaoForImport = (nota, dedupe) => {
  const fromApi = extractIntegracaoId(nota);
  if (fromApi) return String(fromApi).trim();
  if (dedupe.kind === 'id_integracao') return dedupe.value;
  if (dedupe.kind === 'plugnotas_id') return `plugnotas:${dedupe.value}`;
  if (dedupe.kind === 'protocol') return `protocol:${dedupe.value}`;
  return dedupe.value;
};

const buildPayloadFromPeriodoNota = (nota, { cnpjPrestador, catalogByDoc = new Map() }) => {
  const payload = {
    prestador: { cpfCnpj: cnpjPrestador },
  };

  const valorServico = nota?.valorServico ?? nota?.valorTotal ?? nota?.valorNfse ?? nota?.valor;
  if (valorServico !== undefined && valorServico !== null && valorServico !== '') {
    payload.valorServico = valorServico;
    payload.servico = [{
      valor: { servico: valorServico },
      valorServico,
    }];
  }

  if (nota?.tomador && typeof nota.tomador === 'object' && !Array.isArray(nota.tomador)) {
    payload.tomador = nota.tomador;
  } else {
    const tomadorDoc = normalizeDoc(
      typeof nota?.tomador === 'string' || typeof nota?.tomador === 'number'
        ? nota.tomador
        : nota?.cpfCnpjTomador ?? nota?.documentoTomador,
    );
    if (tomadorDoc) {
      const nomeCatalogo = catalogByDoc.get(tomadorDoc) || null;
      const nomeApi = String(nota?.nomeTomador ?? nota?.tomadorNome ?? nota?.razaoSocialTomador ?? '').trim() || null;
      payload.tomador = {
        cpfCnpj: tomadorDoc,
        razaoSocial: nomeApi || nomeCatalogo || null,
        nome: nomeApi || nomeCatalogo || null,
      };
    }
  }

  if (nota?.servico && typeof nota.servico === 'object') payload.servico = nota.servico;
  if (nota?.servicos) payload.servicos = nota.servicos;
  if (nota?.valor !== undefined && payload.valor === undefined) payload.valor = nota.valor;

  return payload;
};

const loadClienteCatalogByDocument = async (userId) => {
  const db = getDb();
  const { data, error } = await db
    .from(CLIENTS_TABLE)
    .select('documento, nome')
    .eq('user_id', userId)
    .eq('document_type', DOCUMENT_TYPE_NFSE)
    .limit(5000);
  if (error) return new Map();

  const map = new Map();
  for (const row of data || []) {
    const doc = normalizeDoc(row.documento);
    const nome = String(row.nome || '').trim();
    if (doc && nome) map.set(doc, nome);
  }
  return map;
};

const loadExistingImportIndex = async (userId) => {
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select('id, id_integracao, plugnotas_id, protocol')
    .eq('user_id', userId)
    .limit(5000);
  if (error) throw badRequest(error.message || 'Falha ao consultar notas existentes');

  const byIntegracao = new Map();
  const byPlugId = new Map();
  const byProtocol = new Map();
  for (const row of data || []) {
    if (row.id_integracao) byIntegracao.set(String(row.id_integracao), row.id);
    if (row.plugnotas_id) byPlugId.set(String(row.plugnotas_id), row.id);
    if (row.protocol) byProtocol.set(String(row.protocol), row.id);
  }
  return { byIntegracao, byPlugId, byProtocol };
};

const findExistingRecordId = (dedupe, index) => {
  if (dedupe.kind === 'id_integracao' && index.byIntegracao.has(dedupe.value)) {
    return index.byIntegracao.get(dedupe.value);
  }
  if (dedupe.kind === 'plugnotas_id' && index.byPlugId.has(dedupe.value)) {
    return index.byPlugId.get(dedupe.value);
  }
  if (dedupe.kind === 'protocol' && index.byProtocol.has(dedupe.value)) {
    return index.byProtocol.get(dedupe.value);
  }
  const plugId = dedupe.kind === 'plugnotas_id' ? dedupe.value : null;
  if (plugId && index.byPlugId.has(plugId)) return index.byPlugId.get(plugId);
  return null;
};

/** Só persiste histórico terminal: concluída na lista; cancelada/rejeitada arquivada. */
const shouldPersistImportedNota = (normalizedStatus) => (
  normalizedStatus === 'concluido'
  || normalizedStatus === 'cancelado'
  || normalizedStatus === 'rejeitado'
);

const resolveArchivedAtForImport = (normalizedStatus, nowIso) => {
  if (normalizedStatus === 'concluido') return null;
  if (normalizedStatus === 'cancelado' || normalizedStatus === 'rejeitado') return nowIso;
  return undefined;
};

const buildImportMetadata = (normalizedStatus, nowIso) => {
  const base = {
    importedFromPlugnotas: true,
    importedAt: nowIso,
  };
  if (normalizedStatus === 'cancelado' || normalizedStatus === 'rejeitado') {
    return {
      ...base,
      arquivamento: {
        archived: true,
        updatedAt: nowIso,
        reason: 'Importação PlugNotas: nota cancelada ou rejeitada',
      },
    };
  }
  return base;
};

const extractEmissaoIsoFromPeriodoNota = (nota) => {
  const candidates = [
    nota?.dataAutorizacao,
    nota?.dataAutorizacaoNfse,
    nota?.dataEmissao,
    nota?.data_emissao,
    nota?.emissao,
    nota?.createdAt,
    nota?.created_at,
  ];
  for (const value of candidates) {
    if (value == null || value === '') continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
};

const mapPeriodoNotaToRow = (nota, { userId, cnpjPrestador, archivedAt = null, catalogByDoc = new Map() }) => {
  const dedupe = buildImportDedupeKey(nota);
  const plugnotasId = extractPlugNotasId(nota);
  const idIntegracao = resolveIdIntegracaoForImport(nota, dedupe);
  const protocol = extractProtocol(nota);
  const status = extractPlugNotasStatus(nota);
  const payloadJson = buildPayloadFromPeriodoNota(nota, { cnpjPrestador, catalogByDoc });
  const cnpjTomador = normalizeDoc(payloadJson?.tomador?.cpfCnpj ?? nota?.tomador);
  const emissaoIso = extractEmissaoIsoFromPeriodoNota(nota);
  const now = new Date().toISOString();

  return {
    dedupe,
    status,
    row: {
      user_id: userId,
      plugnotas_id: plugnotasId ? String(plugnotasId) : null,
      id_integracao: idIntegracao,
      protocol,
      status,
      document_type: DOCUMENT_TYPE_NFSE,
      provider: PROVIDER_PLUGNOTAS,
      cnpj_prestador: cnpjPrestador,
      cnpj_tomador: cnpjTomador || null,
      payload_json: payloadJson,
      response_json: nota,
      archived_at: archivedAt,
      metadata_json: buildImportMetadata(status, now),
      created_at: emissaoIso,
      updated_at: now,
    },
  };
};

/**
 * Importa NFS-e já emitidas na PlugNotas para `mei_nfse` (histórico do emissor).
 * Paginação: 25 notas/página na API PlugNotas.
 */
export const importarHistoricoPlugnotas = async (
  userId,
  {
    cnpj,
    dataInicial,
    dataFinal,
    maxPages,
  } = {},
) => {
  if (!userId) throw badRequest('Usuário não informado');

  const cnpjPrestador = await resolvePrestadorCnpj(userId, cnpj);
  const safeMaxPages = clampMaxPages(maxPages);
  const periodo = dataInicial && dataFinal
    ? { dataInicial: String(dataInicial).slice(0, 10), dataFinal: String(dataFinal).slice(0, 10) }
    : resolveDefaultPeriodo();

  const windows = buildPlugnotasPeriodoWindows(periodo.dataInicial, periodo.dataFinal);
  if (!windows.length) {
    throw badRequest('Período inválido para importação do histórico de notas.');
  }

  const index = await loadExistingImportIndex(userId);
  const catalogByDoc = await loadClienteCatalogByDocument(userId);
  const db = getDb();

  let pagesFetched = 0;
  let pagesRemaining = safeMaxPages;
  let windowsProcessed = 0;
  let totalFetched = 0;
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let ignored = 0;
  let importedConcluidas = 0;
  let importedArquivadas = 0;
  let hasMore = false;
  let hashProximaPagina = null;

  for (const window of windows) {
    if (pagesRemaining <= 0) {
      hasMore = true;
      break;
    }

    let windowHash;
    let windowExhausted = false;

    do {
      let body;
      try {
        body = await consultarNfsePorPeriodo({
          cpfCnpj: cnpjPrestador,
          dataInicial: window.dataInicial,
          dataFinal: window.dataFinal,
          ...(windowHash ? { hashProximaPagina: windowHash } : {}),
        });
      } catch (error) {
        throw badRequest(
          error?.message || 'Não foi possível consultar o histórico de notas na PlugNotas.',
        );
      }

      pagesFetched += 1;
      pagesRemaining -= 1;
      const notas = collectPeriodoNotas(body);
      totalFetched += notas.length;

      for (const nota of notas) {
        const normalizedStatus = extractPlugNotasStatus(nota);
        if (!shouldPersistImportedNota(normalizedStatus)) {
          ignored += 1;
          continue;
        }

        const nowIso = new Date().toISOString();
        const archivedAt = resolveArchivedAtForImport(normalizedStatus, nowIso);
        const mapped = mapPeriodoNotaToRow(nota, { userId, cnpjPrestador, archivedAt, catalogByDoc });
        const existingId = findExistingRecordId(mapped.dedupe, index);

        if (existingId) {
          const { error } = await db
            .from(TABLE)
            .update({
              plugnotas_id: mapped.row.plugnotas_id,
              id_integracao: mapped.row.id_integracao,
              protocol: mapped.row.protocol,
              status: mapped.row.status,
              cnpj_prestador: mapped.row.cnpj_prestador,
              cnpj_tomador: mapped.row.cnpj_tomador,
              payload_json: mapped.row.payload_json,
              response_json: mapped.row.response_json,
              metadata_json: mapped.row.metadata_json,
              created_at: mapped.row.created_at,
              archived_at: archivedAt,
              updated_at: mapped.row.updated_at,
            })
            .eq('id', existingId)
            .eq('user_id', userId);
          if (error) {
            skipped += 1;
            continue;
          }
          updated += 1;
          if (normalizedStatus === 'concluido') importedConcluidas += 1;
          else importedArquivadas += 1;
          continue;
        }

        const { data: created, error } = await db
          .from(TABLE)
          .insert(mapped.row)
          .select('id, id_integracao, plugnotas_id, protocol')
          .single();
        if (error) {
          skipped += 1;
          continue;
        }
        imported += 1;
        if (normalizedStatus === 'concluido') importedConcluidas += 1;
        else importedArquivadas += 1;
        if (created?.id_integracao) index.byIntegracao.set(String(created.id_integracao), created.id);
        if (created?.plugnotas_id) index.byPlugId.set(String(created.plugnotas_id), created.id);
        if (created?.protocol) index.byProtocol.set(String(created.protocol), created.id);
      }

      const nextHash = body?.hashProximaPagina;
      if (nextHash && typeof nextHash === 'string') {
        windowHash = nextHash;
        hashProximaPagina = nextHash;
        if (pagesRemaining <= 0) {
          hasMore = true;
          break;
        }
      } else {
        windowExhausted = true;
        windowHash = undefined;
      }
    } while (!windowExhausted && pagesRemaining > 0);

    windowsProcessed += 1;
    if (pagesRemaining <= 0) {
      hasMore = windowsProcessed < windows.length || Boolean(windowHash);
      break;
    }
  }

  if (windowsProcessed < windows.length) {
    hasMore = true;
  }

  return {
    cnpjPrestador,
    dataInicial: periodo.dataInicial,
    dataFinal: periodo.dataFinal,
    windowsTotal: windows.length,
    windowsProcessed,
    pagesFetched,
    totalFetched,
    imported,
    updated,
    skipped,
    ignored,
    importedConcluidas,
    importedArquivadas,
    hasMore,
    hashProximaPagina,
  };
};

export { shouldPersistImportedNota };
