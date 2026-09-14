import { unwrapPlugnotasEmpresaRecord } from '../mei-emitente-empresa-sync.js';
import { env } from '../../config/env.js';
import {
  consultarEmpresaPlugNotas,
  extractCertificadoIdFromEmpresaPayload,
  patchEmpresaPlugnotasDirect,
  resolverCertificadoIdPorCnpj,
} from './empresa.service.js';
import { resolvePlugnotasCertificadoIdForUser } from './plugnotas-mei-nfse-emit-prep.js';
import { relatorioNfe } from './nfe.service.js';
const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

const parsePositiveInt = (value, fallback = NaN) => {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (Number.isFinite(n) && n >= 1) return n;
  return fallback;
};

const NFE_SYNC_RETRY_MAX = 3;
const NFE_SYNC_RETRY_BASE_MS = 2000;

const resolveNfeSyncTimeoutMs = () => {
  const dedicated = Number(env.PLUGNOTAS_NFE_SYNC_TIMEOUT_MS || 0);
  if (Number.isFinite(dedicated) && dedicated >= 5000) return dedicated;
  const base = Number(env.PLUGNOTAS_TIMEOUT_MS || 15000);
  return Math.max(base, 45000);
};

const isRetryableNfeSyncError = (error) => {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/certificado digital não encontrado/i.test(message)) return false;
  return /aborted|timeout|timed out|ECONNRESET|ETIMEDOUT|fetch failed|502|503|504|gateway/i.test(message);
};

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extrai nNF (9 dígitos) de chave de acesso NF-e (44 dígitos).
 * @param {string} chave
 * @returns {number|null}
 */
export function parseNnfFromNfeChaveAcesso(chave) {
  const digits = normalizeDoc(chave);
  if (digits.length !== 44) return null;
  const n = parsePositiveInt(digits.slice(25, 34), NaN);
  return Number.isFinite(n) ? n : null;
}

const collectPlugnotasNfeBodies = (response) => {
  if (Array.isArray(response)) return response.filter((item) => item && typeof item === 'object');
  if (!response || typeof response !== 'object') return [];
  const list = [response];
  if (Array.isArray(response.documents)) list.push(...response.documents);
  if (Array.isArray(response.documentos)) list.push(...response.documentos);
  if (response.data !== undefined && response.data !== null) {
    if (Array.isArray(response.data)) list.push(...response.data);
    else if (typeof response.data === 'object') list.push(response.data);
  }
  if (response.nfe && typeof response.nfe === 'object') list.push(response.nfe);
  if (response.documento && typeof response.documento === 'object') list.push(response.documento);
  return list;
};

/**
 * @param {unknown} body
 * @returns {number|null}
 */
export function readNfeNumeroFromPlugnotasBody(body) {
  const candidates = collectPlugnotasNfeBodies(body);
  if (!candidates.length && body && typeof body === 'object') candidates.push(body);

  let max = 0;
  for (const candidate of candidates) {
    const direct = parsePositiveInt(
      candidate?.numero
        ?? candidate?.nNF
        ?? candidate?.numeroNota
        ?? candidate?.ide?.nNF,
      NaN,
    );
    const chaveRaw = candidate?.chave
      ?? candidate?.chaveAcesso
      ?? candidate?.chNFe
      ?? candidate?.chaveNfe;
    const fromChave = chaveRaw ? parseNnfFromNfeChaveAcesso(String(chaveRaw)) : null;
    for (const n of [direct, fromChave]) {
      if (Number.isFinite(n) && n >= 1 && n > max) max = n;
    }
  }
  return max > 0 ? max : null;
}

/**
 * @param {{ payload_json?: unknown, response_json?: unknown }|null|undefined} row
 * @returns {number|null}
 */
export function readNfeNumeroFromHistoryRow(row) {
  if (!row || typeof row !== 'object') return null;
  const fromPayload = readNfeNumeroFromPlugnotasBody(row.payload_json);
  const fromResponse = readNfeNumeroFromPlugnotasBody(row.response_json);
  const max = Math.max(fromPayload ?? 0, fromResponse ?? 0);
  return max > 0 ? max : null;
}

/**
 * @param {unknown} empresaJson
 * @returns {{ serie: number|string, numero: number }|null}
 */
export function readPlugnotasNfeNextFromEmpresa(empresaJson) {
  const empresa = unwrapPlugnotasEmpresaRecord(empresaJson);
  const config = empresa?.nfe?.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;

  const serieRaw = config.serie ?? config.serieNfe;
  const serie = serieRaw === undefined || serieRaw === null || serieRaw === ''
    ? 1
    : serieRaw;
  const numero = parsePositiveInt(config.numero ?? config.numeroAtual ?? config.proximoNumero);
  if (!Number.isFinite(numero)) return null;
  return { serie, numero };
}

const collectRelatorioNotas = (body) => {
  if (!body || typeof body !== 'object') return [];
  const candidates = [body.notas, body.documentos, body.data, body.nfes, body.lista];
  for (const list of candidates) {
    if (Array.isArray(list) && list.length) return list;
  }
  if (Array.isArray(body)) return body;
  return [];
};

const PLUGNOTAS_NFE_RELATORIO_MAX_PAGES = 15;

/**
 * Maior nNF já emitido (relatório PlugNotas).
 * @param {string} cnpjInput
 * @param {{ maxPages?: number }} [opts]
 * @returns {Promise<number|null>}
 */
export async function queryMaxNfeNumeroFromPlugnotasRelatorio(cnpjInput, opts = {}) {
  const cnpj = normalizeDoc(cnpjInput);
  if (cnpj.length !== 14) return null;

  const maxPages = Number.isFinite(opts.maxPages)
    ? Math.max(1, Math.trunc(opts.maxPages))
    : PLUGNOTAS_NFE_RELATORIO_MAX_PAGES;

  let hashProximaPagina;
  let maxKnown = 0;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 365);
  const dataInicial = start.toISOString().slice(0, 10);
  const dataFinal = end.toISOString().slice(0, 10);

  for (let page = 0; page < maxPages; page += 1) {
    let body;
    try {
      body = await relatorioNfe({
        cpfCnpj: cnpj,
        cnpj,
        dataInicial,
        dataFinal,
        ...(hashProximaPagina ? { hashProximaPagina } : {}),
      });
    } catch (error) {
      console.warn(
        '[plugnotas-nfe] falha ao consultar relatório NF-e',
        error instanceof Error ? error.message : error,
      );
      break;
    }

    const notas = collectRelatorioNotas(body);
    for (const nota of notas) {
      const numero = readNfeNumeroFromPlugnotasBody(nota);
      if (numero > maxKnown) maxKnown = numero;
    }

    const nextHash = body?.hashProximaPagina ?? body?.hashProxima;
    if (!nextHash || typeof nextHash !== 'string') break;
    hashProximaPagina = nextHash;
  }

  return maxKnown > 0 ? maxKnown : null;
}

/**
 * @param {string} cnpjInput
 * @param {number|null|undefined} localMaxNumero
 * @returns {Promise<number>}
 */
export async function queryAuthoritativeNfeMaxUsed(cnpjInput, localMaxNumero = 0) {
  const localMax = parsePositiveInt(localMaxNumero, 0);
  const relatorioMax = parsePositiveInt(await queryMaxNfeNumeroFromPlugnotasRelatorio(cnpjInput), 0);
  return Math.max(localMax, relatorioMax);
}

/**
 * Próximo nNF: nunca abaixo do cadastro PlugNotas nem do maior já usado (local/relatório).
 * @param {{ empresaNumero?: number|null, localMaxNumero?: number|null, periodoMaxNumero?: number|null }} sources
 * @returns {number}
 */
export function resolveNextNfeNumeroFromSources(sources = {}) {
  const localMax = parsePositiveInt(sources.localMaxNumero, 0);
  const periodoMax = parsePositiveInt(sources.periodoMaxNumero, 0);
  const empresaNext = parsePositiveInt(sources.empresaNumero, 0);
  const maxUsed = Math.max(localMax, periodoMax);
  const fromHistory = maxUsed >= 1 ? maxUsed + 1 : 1;
  const fromEmpresa = empresaNext >= 1 ? empresaNext : 1;
  return Math.max(fromHistory, fromEmpresa);
}

const readCertificadoIdFromEmpresaJson = (empresaJson) => {
  const id = extractCertificadoIdFromEmpresaPayload(empresaJson);
  return id != null ? String(id).trim() : '';
};

const resolveCertificadoIdForEmpresaNfePatch = async (cnpj, empresaJson, userId = null) => {
  const fromEmpresa = readCertificadoIdFromEmpresaJson(empresaJson);
  if (fromEmpresa) return fromEmpresa;

  if (userId) {
    try {
      const fromUser = await resolvePlugnotasCertificadoIdForUser(userId, cnpj);
      const userCertId = fromUser != null ? String(fromUser).trim() : '';
      if (userCertId) return userCertId;
    } catch (error) {
      console.warn(
        '[plugnotas-nfe] certificado local/PlugNotas indisponível para PATCH numeração',
        error instanceof Error ? error.message : error,
      );
    }
  }

  try {
    const resolved = await resolverCertificadoIdPorCnpj(cnpj);
    const id = resolved != null ? String(resolved).trim() : '';
    return id || null;
  } catch (error) {
    console.warn(
      '[plugnotas-nfe] não foi possível resolver certificado para PATCH numeração',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
};

const patchPlugnotasEmpresaNfeNextNumero = async (cnpj, empresaJson, { serie, numero }, opts = {}) => {
  const empresa = unwrapPlugnotasEmpresaRecord(empresaJson);
  const nfeBlock = empresa?.nfe && typeof empresa.nfe === 'object' ? empresa.nfe : {};
  const existingConfig = nfeBlock.config && typeof nfeBlock.config === 'object'
    ? nfeBlock.config
    : { producao: true };

  /** PATCH directo — `atualizarEmpresaPlugNotas` apaga `nfe.config` (política “apenas NFS-e”). */
  const patchBody = {
    nfe: {
      ...nfeBlock,
      ativo: nfeBlock.ativo !== false,
      tipoContrato: nfeBlock.tipoContrato ?? 0,
      config: {
        ...existingConfig,
        serie,
        numero,
      },
    },
  };

  const certificado = await resolveCertificadoIdForEmpresaNfePatch(cnpj, empresaJson, opts.userId ?? null);
  if (certificado) {
    patchBody.certificado = certificado;
  }

  const result = await patchEmpresaPlugnotasDirect(cnpj, patchBody);
  if (!result?.response) {
    const message = result?.lastError instanceof Error
      ? result.lastError.message
      : String(result?.lastError || 'PATCH numeração NF-e sem resposta do emissor');
    throw new Error(message);
  }
};

/**
 * Alinha `nfe.config.numero` na PlugNotas antes do POST /nfe.
 * @param {string} cnpjInput
 * @param {{ serie: number|string, numero: number }} target
 * @param {unknown} [empresaJson]
 * @param {{ strict?: boolean, userId?: string|null }} [opts]
 */
export async function syncPlugnotasNfeNumeracaoBeforeEmit(cnpjInput, target, empresaJson = null, opts = {}) {
  const cnpj = normalizeDoc(cnpjInput);
  const targetNumero = parsePositiveInt(target?.numero);
  if (cnpj.length !== 14 || !Number.isFinite(targetNumero)) return;

  const usedSerie = target?.serie ?? 1;

  let empresa = empresaJson;
  if (!empresa) {
    try {
      empresa = await consultarEmpresaPlugNotas(cnpj);
    } catch {
      empresa = null;
    }
  }

  const current = empresa ? readPlugnotasNfeNextFromEmpresa(empresa) : null;
  if (
    current
    && String(current.serie) === String(usedSerie)
    && current.numero === targetNumero
  ) {
    return;
  }

  let lastError;
  const timeoutMs = resolveNfeSyncTimeoutMs();
  for (let attempt = 1; attempt <= NFE_SYNC_RETRY_MAX; attempt += 1) {
    try {
      await patchPlugnotasEmpresaNfeNextNumero(
        cnpj,
        empresa,
        { serie: usedSerie, numero: targetNumero },
        { timeoutMs, userId: opts.userId ?? null },
      );
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[plugnotas-nfe] PATCH numeração tentativa falhou', { attempt, message });
      if (attempt >= NFE_SYNC_RETRY_MAX || !isRetryableNfeSyncError(error)) break;
      await sleepMs(NFE_SYNC_RETRY_BASE_MS * attempt);
    }
  }

  if (lastError) {
    const message = lastError instanceof Error ? lastError.message : String(lastError);
    if (opts.strict === true) {
      if (/certificado digital não encontrado/i.test(message)) {
        throw new Error(message);
      }
      throw new Error(`Não foi possível alinhar a numeração NF-e na PlugNotas: ${message}`);
    }
  }
}

/**
 * @param {unknown} text
 * @returns {boolean}
 */
export function isPlugnotasNfeDuplicidadeMessage(text) {
  const lower = String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (!lower.includes('duplicidade')) return false;
  return lower.includes('nf-e')
    || lower.includes('nfe')
    || lower.includes('chnfe')
    || lower.includes('chave de acesso');
}

/**
 * @param {unknown} response
 * @returns {boolean}
 */
export function isPlugnotasNfeDuplicidadeFromResponse(response) {
  const bodies = collectPlugnotasNfeBodies(response);
  for (const body of bodies) {
    const parts = [
      body?.message,
      body?.mensagem,
      body?.error?.message,
      body?.retorno?.mensagem,
      body?.motivo,
      body?.xMotivo,
    ];
    for (const part of parts) {
      if (isPlugnotasNfeDuplicidadeMessage(part)) return true;
    }
  }
  if (typeof response === 'string' && isPlugnotasNfeDuplicidadeMessage(response)) return true;
  return false;
}

/**
 * @param {unknown} response
 * @returns {number|null}
 */
export function extractDuplicidadeNfeNumeroFromResponse(response) {
  const bodies = collectPlugnotasNfeBodies(response);
  const chunks = [];
  for (const body of bodies) {
    chunks.push(
      body?.message,
      body?.mensagem,
      body?.error?.message,
      body?.retorno?.mensagem,
      body?.motivo,
      body?.xMotivo,
    );
  }
  const text = chunks.filter(Boolean).join(' ');
  const chaveMatch = text.match(/\d{44}/);
  if (chaveMatch) {
    const fromChave = parseNnfFromNfeChaveAcesso(chaveMatch[0]);
    if (fromChave) return fromChave;
  }
  return readNfeNumeroFromPlugnotasBody(response);
}

export const isMeiNfeNumeracaoHealEnabled = () => {
  const raw = String(process.env.MEI_NFE_NUMERACAO_HEAL_ENABLED ?? 'true').trim().toLowerCase();
  return ['1', 'true', 'yes', 'sim'].includes(raw);
};

/**
 * Calcula próximo nNF seguro e sincroniza cadastro PlugNotas.
 * @param {string} cnpjInput
 * @param {{ localMaxNumero?: number|null, relatorioMaxNumero?: number|null, empresaJson?: unknown, userId?: string|null }} [opts]
 */
export async function ensurePlugnotasNfeNumeracaoBeforeEmit(cnpjInput, opts = {}) {
  const cnpj = normalizeDoc(cnpjInput);
  if (cnpj.length !== 14) return null;

  let relatorioMax = parsePositiveInt(opts.relatorioMaxNumero, 0);
  if (!relatorioMax) {
    relatorioMax = parsePositiveInt(await queryMaxNfeNumeroFromPlugnotasRelatorio(cnpj), 0);
  }

  const localMax = parsePositiveInt(opts.localMaxNumero, 0);

  let empresaJson = opts.empresaJson ?? null;
  if (!empresaJson) {
    try {
      empresaJson = await consultarEmpresaPlugNotas(cnpj);
    } catch {
      empresaJson = null;
    }
  }

  const fromEmpresa = empresaJson ? readPlugnotasNfeNextFromEmpresa(empresaJson) : null;
  const safeNext = resolveNextNfeNumeroFromSources({
    empresaNumero: fromEmpresa?.numero,
    localMaxNumero: localMax,
    periodoMaxNumero: relatorioMax,
  });
  const serie = fromEmpresa?.serie ?? 1;

  await syncPlugnotasNfeNumeracaoBeforeEmit(
    cnpj,
    { serie, numero: safeNext },
    empresaJson,
    { strict: true, userId: opts.userId ?? null },
  );

  return { serie, numero: safeNext, localMax, relatorioMax, empresaNumero: fromEmpresa?.numero ?? null };
}

/**
 * Após emissão, avança contador para numero + 1 (best-effort).
 * @param {string} cnpjInput
 * @param {{ serie?: number|string, numero: number }} used
 */
export async function advancePlugnotasNfeNumeracaoAfterEmit(cnpjInput, used) {
  const cnpj = normalizeDoc(cnpjInput);
  const usedNumero = parsePositiveInt(used?.numero);
  if (cnpj.length !== 14 || !Number.isFinite(usedNumero)) return;

  const next = usedNumero + 1;
  const serie = used?.serie ?? 1;
  await syncPlugnotasNfeNumeracaoBeforeEmit(cnpj, { serie, numero: next }, null, { strict: false })
    .catch(() => {});
}
