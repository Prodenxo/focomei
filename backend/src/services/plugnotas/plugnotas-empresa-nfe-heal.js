import { unwrapPlugnotasEmpresaRecord } from '../mei-emitente-empresa-sync.js';
import { env } from '../../config/env.js';
import {
  consultarEmpresaPlugNotas,
  extractCertificadoIdFromEmpresaPayload,
  patchEmpresaPlugnotasDirect,
  resolverCertificadoIdPorCnpj,
} from './empresa.service.js';
import { resolvePlugnotasCertificadoIdForUser } from './plugnotas-mei-nfse-emit-prep.js';
import { consultarNfePorPeriodo } from './nfe.service.js';
import {
  PLUGNOTAS_REGIME_ESPECIAL_MEI,
  PLUGNOTAS_REGIME_TRIBUTARIO_MEI,
} from './plugnotas-mei-empresa-policy.js';
import {
  PLUGNOTAS_NFE_VERSAO_ESQUEMA_ACCEPTED,
  PLUGNOTAS_NFE_VERSAO_ESQUEMA_MEI,
} from './plugnotas-mei-nfe-emit-force.js';
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
  const fromResponse = readMaxNfeNumeroFromPeriodoNota(row.response_json)
    ?? readNfeNumeroFromPlugnotasBody(row.response_json);
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

  const numeracaoFirst = Array.isArray(config.numeracao) ? config.numeracao[0] : null;
  const numeracaoObj = config.numeracao && typeof config.numeracao === 'object' && !Array.isArray(config.numeracao)
    ? config.numeracao
    : null;

  const serieRaw = numeracaoFirst?.serie
    ?? numeracaoObj?.serie
    ?? config.serie
    ?? config.serieNfe;
  const serie = serieRaw === undefined || serieRaw === null || serieRaw === ''
    ? 1
    : serieRaw;
  const numero = parsePositiveInt(
    numeracaoFirst?.numero
      ?? numeracaoObj?.numero
      ?? config.numero
      ?? config.numeroAtual
      ?? config.proximoNumero,
  );
  if (!Number.isFinite(numero)) return null;
  return { serie, numero };
}

/**
 * Monta `nfe.config` para PATCH de numeração — remove `numeracao` incompleto (PlugNotas rejeita).
 * @param {Record<string, unknown>|null|undefined} existingConfig
 * @param {{ serie?: number|string, numero: number }} target
 */
export function buildPlugnotasNfeConfigForNumeracaoPatch(existingConfig, target) {
  const base = existingConfig && typeof existingConfig === 'object' && !Array.isArray(existingConfig)
    ? existingConfig
    : { producao: true };

  const serie = target?.serie ?? 1;
  const numero = parsePositiveInt(target?.numero);
  if (!Number.isFinite(numero)) {
    throw new Error('Número NF-e inválido para sincronizar na PlugNotas');
  }

  const serieValue = Number.isFinite(Number(serie)) ? Number(serie) : serie;
  const producao = typeof base.producao === 'boolean' ? base.producao : true;

  /**
   * PATCH mínimo — não misturar `versaoEsquema`/flat com `numeracao[]` (PlugNotas retorna 400).
   */
  return {
    producao,
    numeracaoAutomatica: false,
    numeracao: [{ serie: serieValue, numero, numeracaoAtual: numero }],
  };
}

const collectPeriodoNfeNotas = (body) => {
  if (!body || typeof body !== 'object') return [];
  if (Array.isArray(body.notas) && body.notas.length) return body.notas;
  return [];
};

/**
 * Maior nNF numa nota do histórico por período (inclui chaves citadas na mensagem de rejeição).
 * @param {unknown} nota
 * @returns {number|null}
 */
export function readMaxNfeNumeroFromPeriodoNota(nota) {
  if (!nota || typeof nota !== 'object') return null;
  let max = readNfeNumeroFromPlugnotasBody(nota) ?? 0;
  const texto = [
    nota.mensagem,
    nota.message,
    nota.chave,
    nota.chaveAcesso,
  ].filter(Boolean).join(' ');
  for (const match of texto.matchAll(/\d{44}/g)) {
    const fromChave = parseNnfFromNfeChaveAcesso(match[0]);
    if (fromChave && fromChave > max) max = fromChave;
  }
  return max > 0 ? max : null;
}

const PLUGNOTAS_NFE_PERIODO_MAX_PAGES = 40;
const PLUGNOTAS_NFE_PERIODO_WINDOW_DAYS = 31;
const PLUGNOTAS_NFE_PERIODO_LOOKBACK_DAYS = 365;

const formatIsoDate = (date) => date.toISOString().slice(0, 10);

/**
 * Maior nNF já emitido (consulta por período PlugNotas — `/nfe/consulta/periodo`).
 * @param {string} cnpjInput
 * @param {{ maxPages?: number, lookbackDays?: number }} [opts]
 * @returns {Promise<number|null>}
 */
export async function queryMaxNfeNumeroFromPlugnotasRelatorio(cnpjInput, opts = {}) {
  const cnpj = normalizeDoc(cnpjInput);
  if (cnpj.length !== 14) return null;

  const maxPages = Number.isFinite(opts.maxPages)
    ? Math.max(1, Math.trunc(opts.maxPages))
    : PLUGNOTAS_NFE_PERIODO_MAX_PAGES;
  const lookbackDays = Number.isFinite(opts.lookbackDays)
    ? Math.max(1, Math.trunc(opts.lookbackDays))
    : PLUGNOTAS_NFE_PERIODO_LOOKBACK_DAYS;

  let maxKnown = 0;
  let pagesUsed = 0;
  const rangeEnd = new Date();
  const rangeStartLimit = new Date(rangeEnd);
  rangeStartLimit.setDate(rangeStartLimit.getDate() - lookbackDays);

  let windowEnd = new Date(rangeEnd);
  while (windowEnd > rangeStartLimit && pagesUsed < maxPages) {
    const windowStart = new Date(windowEnd);
    windowStart.setDate(windowStart.getDate() - PLUGNOTAS_NFE_PERIODO_WINDOW_DAYS);
    if (windowStart < rangeStartLimit) {
      windowStart.setTime(rangeStartLimit.getTime());
    }

    let hashProximaPagina;
    for (let page = 0; page < maxPages && pagesUsed < maxPages; page += 1) {
      pagesUsed += 1;
      let body;
      try {
        body = await consultarNfePorPeriodo({
          cpfCnpj: cnpj,
          dataInicial: formatIsoDate(windowStart),
          dataFinal: formatIsoDate(windowEnd),
          ...(hashProximaPagina ? { hashProximaPagina } : {}),
        });
      } catch (error) {
        console.warn(
          '[plugnotas-nfe] falha ao consultar histórico NF-e por período',
          error instanceof Error ? error.message : error,
        );
        break;
      }

      for (const nota of collectPeriodoNfeNotas(body)) {
        const numero = readMaxNfeNumeroFromPeriodoNota(nota);
        if (numero > maxKnown) maxKnown = numero;
      }

      const nextHash = body?.hashProximaPagina;
      if (!nextHash || typeof nextHash !== 'string') break;
      hashProximaPagina = nextHash;
    }

    windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() - 1);
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
/**
 * Informa série/nNF no JSON de emissão (PlugNotas: campos raiz `serie` e `numero`).
 * @param {Record<string, unknown>} payload
 * @param {{ serie?: number|string, numero?: number }|null|undefined} numeracao
 */
export function applyPlugnotasNfeNumeracaoToEmitPayload(payload, numeracao) {
  if (!payload || typeof payload !== 'object' || !numeracao) return payload;
  const numero = parsePositiveInt(numeracao.numero);
  if (!Number.isFinite(numero)) return payload;
  const serieRaw = numeracao.serie ?? 1;
  const serie = Number.isFinite(Number(serieRaw)) ? Number(serieRaw) : serieRaw;
  return {
    ...payload,
    serie,
    numero,
  };
}

export function resolveNextNfeNumeroFromSources(sources = {}) {
  const localMax = parsePositiveInt(sources.localMaxNumero, 0);
  const periodoMax = parsePositiveInt(sources.periodoMaxNumero, 0);
  const empresaNext = parsePositiveInt(sources.empresaNumero, 0);
  const maxUsed = Math.max(localMax, periodoMax);
  const fromHistory = maxUsed >= 1 ? maxUsed + 1 : 0;
  const candidates = [fromHistory, empresaNext, 1].filter((n) => Number.isFinite(n) && n >= 1);
  return Math.max(...candidates);
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
      ativo: true,
      tipoContrato: nfeBlock.tipoContrato ?? 0,
      config: buildPlugnotasNfeConfigForNumeracaoPatch(existingConfig, { serie, numero }),
    },
  };

  patchBody.regimeTributario = PLUGNOTAS_REGIME_TRIBUTARIO_MEI;
  patchBody.regimeTributarioEspecial = PLUGNOTAS_REGIME_ESPECIAL_MEI;
  patchBody.simplesNacional = true;

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

  const empresaRecord = unwrapPlugnotasEmpresaRecord(empresa) || {};
  const current = empresa ? readPlugnotasNfeNextFromEmpresa(empresa) : null;
  const numeracaoAutomaticaAtiva = empresaRecord?.nfe?.config?.numeracaoAutomatica !== false;
  /** Número certo com automática ligada ainda emite nNF=1 — força PATCH mínimo. */
  if (
    current
    && String(current.serie) === String(usedSerie)
    && current.numero === targetNumero
    && !numeracaoAutomaticaAtiva
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
export function isPlugnotasNfeDocumentoInativoMessage(text) {
  const lower = String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return lower.includes('documento') && lower.includes('ativo') && lower.includes('emissor');
}

export function isPlugnotasNfeDuplicidadeMessage(text) {
  const lower = String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (lower.includes('duplicidade')) {
    return lower.includes('nf-e')
      || lower.includes('nfe')
      || lower.includes('chnfe')
      || lower.includes('chave de acesso');
  }
  if (lower.includes('codigo numerico') && lower.includes('chave de acesso')) return true;
  if (lower.includes('chave de acesso difere') && lower.includes('bd')) return true;
  return false;
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
  let maxFromChaves = 0;
  for (const match of text.matchAll(/\d{44}/g)) {
    const fromChave = parseNnfFromNfeChaveAcesso(match[0]);
    if (fromChave && fromChave > maxFromChaves) maxFromChaves = fromChave;
  }
  if (maxFromChaves > 0) return maxFromChaves;
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
/**
 * Confirma que o cadastro PlugNotas refletiu o próximo nNF antes do POST /nfe.
 * @param {string} cnpjInput
 * @param {number} expectedNumero
 */
export async function assertPlugnotasNfeNumeracaoAtLeast(cnpjInput, expectedNumero) {
  const cnpj = normalizeDoc(cnpjInput);
  const expected = parsePositiveInt(expectedNumero);
  if (cnpj.length !== 14 || !Number.isFinite(expected)) return;

  let empresaJson;
  try {
    empresaJson = await consultarEmpresaPlugNotas(cnpj);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Não foi possível confirmar a numeração NF-e na PlugNotas: ${message}`);
  }

  const current = readPlugnotasNfeNextFromEmpresa(empresaJson);
  if (current && current.numero >= expected) return;

  throw new Error(
    `Numeração NF-e não atualizou na PlugNotas (próximo esperado: ${expected}, `
    + `cadastro: ${current?.numero ?? 'vazio'}). Tente emitir de novo em alguns segundos.`,
  );
}

export async function ensurePlugnotasNfeNumeracaoBeforeEmit(cnpjInput, opts = {}) {
  const cnpj = normalizeDoc(cnpjInput);
  if (cnpj.length !== 14) return null;

  let relatorioMax = parsePositiveInt(opts.relatorioMaxNumero, 0);
  if (!relatorioMax) {
    relatorioMax = parsePositiveInt(await queryMaxNfeNumeroFromPlugnotasRelatorio(cnpj), 0);
  }

  const localMax = parsePositiveInt(opts.localMaxNumero, 0);

  let empresaJson = null;
  try {
    empresaJson = await consultarEmpresaPlugNotas(cnpj);
  } catch {
    empresaJson = opts.empresaJson ?? null;
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

  await sleepMs(400);
  await assertPlugnotasNfeNumeracaoAtLeast(cnpj, safeNext);

  console.info('[plugnotas-nfe] numeração alinhada antes da emissão', {
    cnpj14: `${cnpj.slice(0, 4)}***${cnpj.slice(-2)}`,
    serie,
    numero: safeNext,
    localMax,
    relatorioMax,
    empresaNumero: fromEmpresa?.numero ?? null,
  });

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
