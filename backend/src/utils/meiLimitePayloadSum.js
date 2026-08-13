/**
 * Paridade com `frontend/src/utils/meiLimiteFaturamento.ts`: somatório do limite MEI
 * a partir de `response_json` (prioridade) e `payload_json` (servico[].valor.liquido | servico).
 */

/** Manter igual a `MEI_LIMITE_ANO_CIVIL_TZ` no frontend. */
export const MEI_LIMITE_ANO_CIVIL_TZ = 'America/Sao_Paulo';

const NFSE = 'NFSE';

/**
 * Somatório do limite MEI (FR-GUIA-FISC-17): apenas **NFSE** entra no agregado; NFE/NFCE ficam de fora até PRD futuro.
 * Paridade com `isDocumentTypeMeiLimiteRelevante` no frontend.
 */
export function isDocumentTypeMeiLimiteRelevante(documentType) {
  const dt = String(documentType ?? '').trim().toUpperCase();
  return dt === NFSE;
}

function nfseStatusAsciiLower(status) {
  return String(status || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export function nfseStatusKeyParaLimite(status) {
  const text = String(status || '').toLowerCase();
  const ascii = nfseStatusAsciiLower(status);
  if (!ascii) return 'processando';
  if (ascii.includes('cancelamento_pendente')
    || (ascii.includes('cancelamento') && ascii.includes('pendente'))) {
    return 'cancelamento_pendente';
  }
  if (ascii.includes('concluido') || ascii.includes('concluida') || ascii.includes('autoriz')) {
    return 'concluido';
  }
  if (ascii.includes('process')) return 'processando';
  if (ascii.includes('rejeit')) return 'rejeitado';
  if (ascii.includes('cancel')) return 'cancelado';
  if (ascii.includes('interromp')) return 'interrompido';
  return text;
}

export function nfseDeveEntrarNoSomatorioLimite(status) {
  return nfseStatusKeyParaLimite(status) === 'concluido';
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

export function normalizarPayloadJsonNfse(input) {
  if (input === null || input === undefined) return null;
  let current = input;
  for (let depth = 0; depth < 6; depth += 1) {
    if (typeof current === 'string') {
      const t = current.trim();
      if (!t) return null;
      try {
        current = JSON.parse(t);
        continue;
      } catch {
        return null;
      }
    }
    if (Array.isArray(current) && current.length === 1) {
      current = current[0];
      continue;
    }
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return current;
    }
    return null;
  }
  return null;
}

function resolverPayloadJsonDaNota(record) {
  const raw = record?.payload_json ?? record?.payloadJson;
  return normalizarPayloadJsonNfse(raw);
}

function resolverResponseJsonDaNota(record) {
  const raw = record?.response_json ?? record?.responseJson;
  return normalizarPayloadJsonNfse(raw);
}

function hasServicoInObj(obj) {
  const s = obj.servico ?? obj.servicos;
  return s != null;
}

export function isNfseDocumentoRow(record) {
  const dt = String(record?.document_type ?? '').trim().toUpperCase();
  if (dt !== '') {
    return isDocumentTypeMeiLimiteRelevante(record?.document_type);
  }
  const p = resolverPayloadJsonDaNota(record);
  if (p && hasServicoInObj(p)) return true;
  const r = resolverResponseJsonDaNota(record);
  return Boolean(r && hasServicoInObj(r));
}

function valorLimiteDeItemServico(item) {
  const valor = item.valor;
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    const liq = parseValorMonetarioBr(valor.liquido);
    if (liq !== null && liq >= 0) return liq;
    const serv = parseValorMonetarioBr(valor.servico);
    if (serv !== null && serv >= 0) return serv;
  }
  const flat = item.valorServico ?? item.valorServiço ?? item.valor_servico;
  const n2 = parseValorMonetarioBr(flat);
  if (n2 !== null && n2 >= 0) return n2;
  return null;
}

export function extrairValorTotalServicosDeObjeto(raw) {
  if (!raw) return null;
  const topLevel = parseValorMonetarioBr(
    raw.valorServico ?? raw.valorTotal ?? raw.valorNfse ?? raw.valor,
  );
  if (topLevel !== null && topLevel >= 0) return topLevel;
  let servicos = raw.servico ?? raw.servicos;
  if (servicos && !Array.isArray(servicos)) {
    servicos = [servicos];
  }
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

export function extrairValorLimiteMeiDaNota(record) {
  const resp = resolverResponseJsonDaNota(record);
  if (resp) {
    const fromResp = extrairValorTotalServicosDeObjeto(resp);
    if (fromResp !== null) return fromResp;
  }
  const payload = resolverPayloadJsonDaNota(record);
  return extrairValorTotalServicosDeObjeto(payload);
}

export function extrairValorServicoTotalDoPayload(payloadJson) {
  const raw = normalizarPayloadJsonNfse(payloadJson);
  return extrairValorTotalServicosDeObjeto(raw);
}

export function anoCivilFromIsoCreatedAt(createdAt) {
  if (!createdAt) return null;
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MEI_LIMITE_ANO_CIVIL_TZ,
    year: 'numeric'
  }).formatToParts(parsed);
  const y = parts.find((p) => p.type === 'year')?.value;
  if (!y) return null;
  const n = parseInt(y, 10);
  return Number.isFinite(n) ? n : null;
}

/** Data de emissão/autorização (PlugNotas) com fallback em created_at. */
export function resolverDataEmissaoDaNota(record) {
  const fiscal = resolverDataAutorizacaoFiscalDaNota(record);
  if (fiscal) return fiscal;
  const resp = resolverResponseJsonDaNota(record);
  if (resp) {
    const competencia = pickFirstEmissionDateFromResponse(resp);
    if (competencia) return competencia;
  }
  const fromIntegracao = parseCreatedAtIsoFromIdIntegracao(record?.id_integracao);
  if (fromIntegracao) return fromIntegracao;
  return parseDateIso(record?.created_at ?? record?.createdAt);
}

/** Autorização fiscal (data real da emissão na prefeitura). */
const FISCAL_AUTH_DATE_FIELD_KEYS = [
  'dataAutorizacao',
  'dataAutorizacaoNfse',
];

/** Competência / emissão no payload — não usar como "Emitida em" na UI. */
const FISCAL_EMISSION_DATE_FIELD_KEYS = [
  'dataEmissao',
  'data_emissao',
  'emissao',
];

const FISCAL_DATE_FIELD_KEYS = [
  ...FISCAL_AUTH_DATE_FIELD_KEYS,
  ...FISCAL_EMISSION_DATE_FIELD_KEYS,
];

function parseDateIso(value) {
  if (value == null || value === '') return null;
  const parsed = new Date(value);
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

function pickFirstFiscalDateFromObject(obj) {
  return pickFirstDateFromObject(obj, FISCAL_DATE_FIELD_KEYS);
}

function pickFirstAuthDateFromObject(obj) {
  return pickFirstDateFromObject(obj, FISCAL_AUTH_DATE_FIELD_KEYS);
}

function pickFirstEmissionDateFromObject(obj) {
  return pickFirstDateFromObject(obj, FISCAL_EMISSION_DATE_FIELD_KEYS);
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

function pickFirstAuthDateFromResponse(response) {
  for (const candidate of collectResponseCandidates(response)) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const iso = pickFirstAuthDateFromObject(candidate);
    if (iso) return iso;
  }
  return null;
}

function pickFirstEmissionDateFromResponse(response) {
  for (const candidate of collectResponseCandidates(response)) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const iso = pickFirstEmissionDateFromObject(candidate);
    if (iso) return iso;
  }
  return null;
}

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

export function resolverDataAutorizacaoFiscalDaNota(record) {
  const resp = resolverResponseJsonDaNota(record);
  if (!resp) return null;
  return pickFirstAuthDateFromResponse(resp);
}

/** Data para exibição "Emitida em": autorização → criação FocoMEI → created_at. */
export function resolverDataExibicaoEmissaoDaNota(record) {
  const auth = resolverDataAutorizacaoFiscalDaNota(record);
  if (auth) return auth;
  const fromIntegracao = parseCreatedAtIsoFromIdIntegracao(record?.id_integracao);
  if (fromIntegracao) return fromIntegracao;
  return parseDateIso(record?.created_at ?? record?.createdAt);
}

function notaListaOrdenacaoMs(record) {
  const iso = resolverDataExibicaoEmissaoDaNota(record)
    || parseDateIso(record?.updated_at)
    || parseDateIso(record?.created_at ?? record?.createdAt);
  if (!iso) return 0;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Ordena notas pela mesma data exibida na lista (mais recente primeiro). */
export function sortNotasPorListaRecencia(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return rows ?? [];
  return [...rows].sort((a, b) => {
    const diff = notaListaOrdenacaoMs(b) - notaListaOrdenacaoMs(a);
    if (diff !== 0) return diff;
    const updatedDiff = notaListaOrdenacaoMs({ created_at: b.updated_at })
      - notaListaOrdenacaoMs({ created_at: a.updated_at });
    if (updatedDiff !== 0) return updatedDiff;
    return String(b?.id ?? '').localeCompare(String(a?.id ?? ''));
  });
}

/**
 * @param {Array<Record<string, unknown>>} rows - linhas com payload_json, response_json, status, created_at, document_type
 * @param {number} anoCivil
 * @returns {{ total: number, notasConsideradas: number }}
 */
export function agregarLimiteMeiDasLinhas(rows, anoCivil) {
  let total = 0;
  let notasConsideradas = 0;
  for (const record of rows || []) {
    if (!isNfseDocumentoRow(record)) continue;
    if (!nfseDeveEntrarNoSomatorioLimite(record.status)) continue;
    const y = anoCivilFromIsoCreatedAt(resolverDataEmissaoDaNota(record));
    if (y !== anoCivil) continue;
    const valor = extrairValorLimiteMeiDaNota(record);
    if (valor === null) continue;
    total += valor;
    notasConsideradas += 1;
  }
  return { total, notasConsideradas };
}
