import type { NfseRecord } from '../services/meiNotasService'
import {
  extrairValorLimiteMeiDaNota,
  isNfseDocumento,
  parseValorMonetarioBr,
  resolverPayloadJsonDaNota,
  resolverResponseJsonDaNota,
} from './meiLimiteFaturamento'

function pickTrimmedString(value: unknown): string | null {
  const s = value != null ? String(value).trim() : ''
  return s || null
}

function extrairNomeDeObjeto(
  raw: Record<string, unknown> | null,
  documentType: string | null | undefined,
): string | null {
  if (!raw) return null
  const dt = String(documentType ?? '').trim().toUpperCase()
  if (dt === 'NFE' || dt === 'NFCE' || raw.destinatario) {
    const dest = raw.destinatario
    if (dest && typeof dest === 'object' && !Array.isArray(dest)) {
      const d = dest as Record<string, unknown>
      const name = pickTrimmedString(d.razaoSocial ?? d.nome ?? d.nomeFantasia)
      if (name) return name
    }
  }
  const tomador = raw.tomador
  if (tomador && typeof tomador === 'object' && !Array.isArray(tomador)) {
    const t = tomador as Record<string, unknown>
    const name = pickTrimmedString(t.razaoSocial ?? t.nome ?? t.nomeFantasia)
    if (name) return name
  }
  return null
}

export function extrairNomeClienteDaNota(record: NfseRecord): string | null {
  const sources = [
    resolverResponseJsonDaNota(record),
    resolverPayloadJsonDaNota(record),
  ].filter(Boolean) as Record<string, unknown>[]
  for (const src of sources) {
    const name = extrairNomeDeObjeto(src, record.document_type)
    if (name) return name
  }
  return null
}

function extrairValorTotalItensDeObjeto(raw: Record<string, unknown> | null): number | null {
  if (!raw) return null
  let itens = raw.itens
  if (itens && !Array.isArray(itens)) itens = [itens]
  if (!Array.isArray(itens) || !itens.length) return null
  let sum = 0
  let any = false
  for (const item of itens) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const n = parseValorMonetarioBr((item as Record<string, unknown>).valor)
    if (n !== null && n >= 0) {
      sum += n
      any = true
    }
  }
  return any ? sum : null
}

function extrairValorPagamentosDeObjeto(raw: Record<string, unknown> | null): number | null {
  if (!raw) return null
  let pagamentos = raw.pagamentos
  if (pagamentos && !Array.isArray(pagamentos)) pagamentos = [pagamentos]
  if (!Array.isArray(pagamentos) || !pagamentos.length) return null
  let sum = 0
  let any = false
  for (const item of pagamentos) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const n = parseValorMonetarioBr((item as Record<string, unknown>).valor)
    if (n !== null && n >= 0) {
      sum += n
      any = true
    }
  }
  return any ? sum : null
}

export function extrairValorDaNota(record: NfseRecord): number | null {
  const dt = String(record.document_type ?? '').trim().toUpperCase()
  if (dt === 'NFSE' || isNfseDocumento(record)) {
    return extrairValorLimiteMeiDaNota(record)
  }
  const sources = [
    resolverResponseJsonDaNota(record),
    resolverPayloadJsonDaNota(record),
  ].filter(Boolean) as Record<string, unknown>[]
  for (const src of sources) {
    const fromPagamentos = extrairValorPagamentosDeObjeto(src)
    if (fromPagamentos !== null) return fromPagamentos
    const fromItens = extrairValorTotalItensDeObjeto(src)
    if (fromItens !== null) return fromItens
  }
  return null
}

export function resolverTituloNotaFiscal(record: NfseRecord): string {
  const cliente = extrairNomeClienteDaNota(record)
  if (cliente) return cliente
  return record.id_integracao || record.plugnotas_id || record.protocol || record.id
}
