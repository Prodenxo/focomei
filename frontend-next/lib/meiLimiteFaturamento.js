import {
  DEFAULT_MEI_LIMITE_THRESHOLDS,
  getLimiteReferenciaReaisParaAno,
} from './meiLimiteFaturamentoConfig.js';
import { getNfseStatusKey, normalizePayloadJson } from './notaFiscalDisplay.js';

export const MEI_LIMITE_ANO_CIVIL_TZ = 'America/Sao_Paulo';

/** Toda nota autorizada emitida pela empresa conta no limite MEI. */
export function isDocumentTypeMeiLimiteRelevante(documentType) {
  const dt = String(documentType ?? '').trim().toUpperCase();
  return dt === 'NFSE' || dt === 'NFE' || dt === 'NFCE';
}

/** Cancelada, rejeitada ou em processamento não soma — apenas autorizada. */
export function nfseDeveEntrarNoSomatorioLimite(status) {
  return getNfseStatusKey(status) === 'concluido';
}

function resolverPayloadJsonDaNota(record) {
  return normalizePayloadJson(record?.payload_json ?? record?.payloadJson);
}

function resolverResponseJsonDaNota(record) {
  return normalizePayloadJson(record?.response_json ?? record?.responseJson);
}

function temServico(obj) {
  return (obj?.servico ?? obj?.servicos) != null;
}

function temItens(obj) {
  return (obj?.itens ?? obj?.items) != null;
}

/** Nota que entra no somatório: NFS-e, NF-e ou legado sem tipo. */
export function isDocumentoLimiteMei(record) {
  const dt = String(record?.document_type ?? record?.documentType ?? '').trim();
  if (dt !== '') return isDocumentTypeMeiLimiteRelevante(dt);
  const payload = resolverPayloadJsonDaNota(record);
  if (payload && (temServico(payload) || temItens(payload))) return true;
  const resp = resolverResponseJsonDaNota(record);
  return Boolean(resp && (temServico(resp) || temItens(resp)));
}

export function parseValorMonetarioBr(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value).trim().replace(/\u00a0/g, '');
  if (!s) return null;
  s = s.replace(/^R\$\s*/i, '');
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && (!hasDot || s.lastIndexOf(',') > s.lastIndexOf('.'))) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasComma && hasDot) {
    s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function valorLimiteDeItemServico(item) {
  const valor = item.valor;
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    const liquido = parseValorMonetarioBr(valor.liquido);
    if (liquido !== null && liquido >= 0) return liquido;
    const servico = parseValorMonetarioBr(valor.servico);
    if (servico !== null && servico >= 0) return servico;
  }
  const flat = item.valorServico ?? item.valorServiço ?? item.valor_servico;
  const n = parseValorMonetarioBr(flat);
  return n !== null && n >= 0 ? n : null;
}

export function extrairValorTotalServicosDeObjeto(raw) {
  if (!raw) return null;
  const topLevel = parseValorMonetarioBr(
    raw.valorServico ?? raw.valorTotal ?? raw.valorNfse ?? raw.valor,
  );
  if (topLevel !== null && topLevel >= 0) return topLevel;

  let servicos = raw.servico ?? raw.servicos;
  if (servicos && !Array.isArray(servicos)) servicos = [servicos];
  if (!Array.isArray(servicos)) return null;

  let sum = 0;
  let any = false;
  for (const item of servicos) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const n = valorLimiteDeItemServico(item);
    if (n !== null) {
      sum += n;
      any = true;
    }
  }
  return any ? sum : null;
}

function valorUnitarioDeItemProduto(item) {
  const vu = item.valorUnitario;
  if (vu && typeof vu === 'object' && !Array.isArray(vu)) {
    const c = parseValorMonetarioBr(vu.comercial);
    if (c !== null && c >= 0) return c;
    const t = parseValorMonetarioBr(vu.tributavel);
    if (t !== null && t >= 0) return t;
  }
  return parseValorMonetarioBr(vu);
}

function quantidadeDeItemProduto(item) {
  const q = item.quantidade;
  if (q && typeof q === 'object' && !Array.isArray(q)) {
    const c = parseValorMonetarioBr(q.comercial);
    if (c !== null && c >= 0) return c;
    const t = parseValorMonetarioBr(q.tributavel);
    if (t !== null && t >= 0) return t;
  }
  return parseValorMonetarioBr(q);
}

function valorLimiteDeItemProduto(item) {
  const direct = parseValorMonetarioBr(item.valor);
  if (direct !== null && direct >= 0) return direct;
  const quantidade = quantidadeDeItemProduto(item);
  const unitario = valorUnitarioDeItemProduto(item);
  if (quantidade !== null && unitario !== null) {
    const total = quantidade * unitario;
    return Number.isFinite(total) && total >= 0 ? total : null;
  }
  return null;
}

/** Total de uma NF-e: valor autorizado no retorno ou a soma dos itens do payload. */
export function extrairValorTotalProdutosDeObjeto(raw) {
  if (!raw) return null;
  const topLevel = parseValorMonetarioBr(raw.valorTotal ?? raw.valorNota ?? raw.valor);
  if (topLevel !== null && topLevel >= 0) return topLevel;

  let itens = raw.itens ?? raw.items;
  if (itens && !Array.isArray(itens)) itens = [itens];
  if (!Array.isArray(itens)) return null;

  let sum = 0;
  let any = false;
  for (const item of itens) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const n = valorLimiteDeItemProduto(item);
    if (n !== null) {
      sum += n;
      any = true;
    }
  }
  return any ? sum : null;
}

function extrairValorServicosDaNota(record) {
  const resp = resolverResponseJsonDaNota(record);
  if (resp) {
    const fromResp = extrairValorTotalServicosDeObjeto(resp);
    if (fromResp !== null) return fromResp;
  }
  return extrairValorTotalServicosDeObjeto(resolverPayloadJsonDaNota(record));
}

function extrairValorProdutosDaNota(record) {
  const resp = resolverResponseJsonDaNota(record);
  if (resp) {
    const fromResp = extrairValorTotalProdutosDeObjeto(resp);
    if (fromResp !== null) return fromResp;
  }
  return extrairValorTotalProdutosDeObjeto(resolverPayloadJsonDaNota(record));
}

/** Valor que a nota soma no limite, conforme o modelo do documento. */
export function extrairValorLimiteMeiDaNota(record) {
  const dt = String(record?.document_type ?? record?.documentType ?? '').trim().toUpperCase();
  if (dt === 'NFE' || dt === 'NFCE') return extrairValorProdutosDaNota(record);
  if (dt === 'NFSE') return extrairValorServicosDaNota(record);
  return extrairValorServicosDaNota(record) ?? extrairValorProdutosDaNota(record);
}

const FISCAL_AUTH_DATE_FIELD_KEYS = ['dataAutorizacao', 'dataAutorizacaoNfse'];
const FISCAL_EMISSION_DATE_FIELD_KEYS = ['dataEmissao', 'data_emissao', 'emissao'];

/** Fuso fixo do Brasil (sem horário de verão desde 2019). */
const BR_UTC_OFFSET = '-03:00';
const BR_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/;

/** A PlugNotas envia dd/mm/aaaa; `new Date` leria como mm/dd/aaaa e trocaria dia por mês. */
export function parseDataBrIso(value) {
  const match = BR_DATE_RE.exec(String(value ?? '').trim());
  if (!match) return null;
  const [, d, m, y, h = '0', min = '0', s = '0'] = match;
  const dia = Number(d);
  const mes = Number(m);
  if (!(mes >= 1 && mes <= 12) || !(dia >= 1 && dia <= 31)) return null;
  const pad = (n) => String(Number(n)).padStart(2, '0');
  const parsed = new Date(
    `${y}-${pad(mes)}-${pad(dia)}T${pad(h)}:${pad(min)}:${pad(s)}${BR_UTC_OFFSET}`,
  );
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function parseDateIso(value) {
  if (value == null || value === '') return null;
  const fromBr = parseDataBrIso(value);
  if (fromBr) return fromBr;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function pickFirstDateFromObject(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of keys) {
    const iso = parseDateIso(obj[key]);
    if (iso) return iso;
  }
  return null;
}

/** Mesma heurística do backend (`collectResponseCandidates`). */
function collectResponseCandidates(response) {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== 'object') return [response];
  const list = [response];
  if (Array.isArray(response.documents)) list.push(...response.documents);
  if (Array.isArray(response.documentos)) list.push(...response.documentos);
  if (response.data !== undefined && response.data !== null) {
    if (Array.isArray(response.data)) list.push(...response.data);
    else if (typeof response.data === 'object') list.push(response.data);
  }
  if (response.nfse && typeof response.nfse === 'object') list.push(response.nfse);
  if (response.documento && typeof response.documento === 'object') list.push(response.documento);
  if (response.retorno && typeof response.retorno === 'object') list.push(response.retorno);
  if (response.xml && typeof response.xml === 'object') {
    list.push(response.xml);
    if (response.xml.retorno && typeof response.xml.retorno === 'object') {
      list.push(response.xml.retorno);
    }
  }
  return list;
}

function pickFirstDateFromResponse(response, keys) {
  for (const candidate of collectResponseCandidates(response)) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const iso = pickFirstDateFromObject(candidate, keys);
    if (iso) return iso;
  }
  return null;
}

/** Timestamp embutido em id_integracao FocoMEI (`mei-{userId}-{Date.now()}-…`). */
export function parseCreatedAtIsoFromIdIntegracao(idIntegracao) {
  const raw = String(idIntegracao ?? '').trim();
  if (!raw.startsWith('mei-')) return null;
  const match = raw.match(/-(\d{13})(?:-|$)/);
  if (!match) return null;
  const ms = Number(match[1]);
  if (!Number.isFinite(ms) || ms < 1e12 || ms > 9.9e12) return null;
  return new Date(ms).toISOString();
}

export function resolverDataEmissaoDaNota(record) {
  const resp = resolverResponseJsonDaNota(record);
  if (resp) {
    const autorizacao = pickFirstDateFromResponse(resp, FISCAL_AUTH_DATE_FIELD_KEYS);
    if (autorizacao) return autorizacao;
    const emissao = pickFirstDateFromResponse(resp, FISCAL_EMISSION_DATE_FIELD_KEYS);
    if (emissao) return emissao;
  }
  const fromIntegracao = parseCreatedAtIsoFromIdIntegracao(record?.id_integracao);
  if (fromIntegracao) return fromIntegracao;
  return parseDateIso(record?.created_at ?? record?.createdAt);
}

export function anoCivilFromIsoCreatedAt(createdAt) {
  if (!createdAt) return null;
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MEI_LIMITE_ANO_CIVIL_TZ,
    year: 'numeric',
  }).formatToParts(parsed);
  const y = parts.find((p) => p.type === 'year')?.value;
  if (!y) return null;
  const n = parseInt(y, 10);
  return Number.isFinite(n) ? n : null;
}

/** Soma as notas autorizadas do ano civil — canceladas e rejeitadas ficam de fora. */
export function somarNotasAutorizadasNoAnoCivil(records, { anoCivil }) {
  let total = 0;
  let notasConsideradas = 0;
  for (const record of records || []) {
    if (!isDocumentoLimiteMei(record)) continue;
    if (!nfseDeveEntrarNoSomatorioLimite(record?.status)) continue;
    if (anoCivilFromIsoCreatedAt(resolverDataEmissaoDaNota(record)) !== anoCivil) continue;
    const valor = extrairValorLimiteMeiDaNota(record);
    if (valor === null) continue;
    total += valor;
    notasConsideradas += 1;
  }
  return { total, notasConsideradas };
}

function clampBarPercent(raw) {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(100, Math.max(0, raw));
}

function resolveBanda(percentual, thresholds) {
  if (percentual === null || !Number.isFinite(percentual)) return 'indeterminado';
  if (percentual >= thresholds.criticoMinPercent) return 'critico';
  if (percentual >= thresholds.atencaoMinPercent) return 'atencao';
  return 'seguro';
}

/**
 * Progresso do limite de faturamento MEI no ano civil.
 * @param {unknown[]} records - notas carregadas na tela
 * @param {{
 *   anoCivil: number,
 *   thresholds?: { atencaoMinPercent: number, criticoMinPercent: number },
 *   limiteReferenciaReaisOverride?: number | null,
 *   agregadoServidor?: { totalUtilizadoReais: number, notasConsideradas: number },
 * }} options
 */
export function computeMeiLimiteProgresso(records, options) {
  const thresholds = options.thresholds ?? DEFAULT_MEI_LIMITE_THRESHOLDS;

  let total;
  let notasConsideradas;
  const local = somarNotasAutorizadasNoAnoCivil(records, { anoCivil: options.anoCivil });

  if (options.agregadoServidor !== undefined) {
    total = options.agregadoServidor.totalUtilizadoReais;
    notasConsideradas = options.agregadoServidor.notasConsideradas;
    // Cancelamento recente aparece na lista antes do agregado do servidor atualizar.
    if (local.notasConsideradas === 0 && total > 0) {
      total = 0;
      notasConsideradas = 0;
    } else if (notasConsideradas === 0 && local.notasConsideradas > 0) {
      total = local.total;
      notasConsideradas = local.notasConsideradas;
    }
  } else {
    total = local.total;
    notasConsideradas = local.notasConsideradas;
  }

  const limite = options.limiteReferenciaReaisOverride !== undefined
    ? options.limiteReferenciaReaisOverride
    : getLimiteReferenciaReaisParaAno(options.anoCivil);

  let percentual = null;
  let paraBarra = null;
  if (limite !== null && limite > 0) {
    percentual = (total / limite) * 100;
    paraBarra = clampBarPercent(percentual);
  }

  const banda = limite === null || limite <= 0
    ? 'indeterminado'
    : resolveBanda(percentual, thresholds);

  return {
    anoCivil: options.anoCivil,
    totalUtilizadoReais: total,
    limiteReferenciaReais: limite,
    percentualUtilizado: percentual,
    percentualUtilizadoParaBarra: paraBarra,
    banda,
    notasConsideradas,
  };
}
