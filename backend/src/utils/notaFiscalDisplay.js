import {
  extrairValorLimiteMeiDaNota,
  isNfseDocumentoRow,
  normalizarPayloadJsonNfse,
  parseValorMonetarioBr,
} from './meiLimitePayloadSum.js';

function resolverPayloadJsonDaNota(record) {
  const raw = record?.payload_json ?? record?.payloadJson;
  return normalizarPayloadJsonNfse(raw);
}

function resolverResponseJsonDaNota(record) {
  const raw = record?.response_json ?? record?.responseJson;
  return normalizarPayloadJsonNfse(raw);
}

function pickTrimmedString(value) {
  const s = value != null ? String(value).trim() : '';
  return s || null;
}

function extrairNomeDeObjeto(raw, documentType) {
  if (!raw || typeof raw !== 'object') return null;
  const dt = String(documentType || '').trim().toUpperCase();
  if (dt === 'NFE' || dt === 'NFCE' || raw.destinatario) {
    const dest = raw.destinatario;
    if (dest && typeof dest === 'object') {
      const name = pickTrimmedString(dest.razaoSocial ?? dest.nome ?? dest.nomeFantasia);
      if (name) return name;
    }
  }
  const tomador = raw.tomador;
  if (tomador && typeof tomador === 'object') {
    const name = pickTrimmedString(tomador.razaoSocial ?? tomador.nome ?? tomador.nomeFantasia);
    if (name) return name;
  }
  return null;
}

export function extrairNomeClienteDaNota(record) {
  const documentType = record?.document_type;
  const sources = [resolverResponseJsonDaNota(record), resolverPayloadJsonDaNota(record)].filter(Boolean);
  for (const src of sources) {
    const name = extrairNomeDeObjeto(src, documentType);
    if (name) return name;
  }
  return null;
}

function extrairValorTotalItensDeObjeto(raw) {
  if (!raw) return null;
  let itens = raw.itens;
  if (itens && !Array.isArray(itens)) itens = [itens];
  if (!Array.isArray(itens) || !itens.length) return null;
  let sum = 0;
  let any = false;
  for (const item of itens) {
    if (!item || typeof item !== 'object') continue;
    const n = parseValorMonetarioBr(item.valor);
    if (n !== null && n >= 0) {
      sum += n;
      any = true;
    }
  }
  return any ? sum : null;
}

function extrairValorPagamentosDeObjeto(raw) {
  if (!raw) return null;
  let pagamentos = raw.pagamentos;
  if (pagamentos && !Array.isArray(pagamentos)) pagamentos = [pagamentos];
  if (!Array.isArray(pagamentos) || !pagamentos.length) return null;
  let sum = 0;
  let any = false;
  for (const item of pagamentos) {
    if (!item || typeof item !== 'object') continue;
    const n = parseValorMonetarioBr(item.valor);
    if (n !== null && n >= 0) {
      sum += n;
      any = true;
    }
  }
  return any ? sum : null;
}

export function extrairValorDaNota(record) {
  const dt = String(record?.document_type ?? '').trim().toUpperCase();
  if (dt === 'NFSE' || isNfseDocumentoRow(record)) {
    return extrairValorLimiteMeiDaNota(record);
  }
  const sources = [resolverResponseJsonDaNota(record), resolverPayloadJsonDaNota(record)].filter(Boolean);
  for (const src of sources) {
    const fromPagamentos = extrairValorPagamentosDeObjeto(src);
    if (fromPagamentos !== null) return fromPagamentos;
    const fromItens = extrairValorTotalItensDeObjeto(src);
    if (fromItens !== null) return fromItens;
  }
  return null;
}

export function documentoFiscalLabel(documentType) {
  const dt = String(documentType ?? '').trim().toUpperCase();
  if (dt === 'NFSE') return 'NFS-e';
  if (dt === 'NFE') return 'NF-e';
  if (dt === 'NFCE') return 'NFC-e';
  return dt || 'Nota fiscal';
}
