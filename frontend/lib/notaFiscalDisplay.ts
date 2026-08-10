import type { NfseRecord } from '../services/meiNotasService'
import { formatDateTime, getNfseStatusKey } from './meiFormatters'
import {
  extrairValorLimiteMeiDaNota,
  isNfseDocumento,
  parseValorMonetarioBr,
  resolverDataAutorizacaoFiscalDaNota,
  resolverPayloadJsonDaNota,
  resolverResponseJsonDaNota,
} from './meiLimiteFaturamento'

function pickTrimmedString(value: unknown): string | null {
  const s = value != null ? String(value).trim() : ''
  return s || null
}

function looksLikeFormattedDocument(name: string): boolean {
  return /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(name)
    || /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(name)
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

  const nomeTomador = pickTrimmedString(
    raw.nomeTomador ?? raw.tomadorNome ?? raw.razaoSocialTomador,
  )
  if (nomeTomador) return nomeTomador

  const tomador = raw.tomador
  if (tomador && typeof tomador === 'object' && !Array.isArray(tomador)) {
    const t = tomador as Record<string, unknown>
    const name = pickTrimmedString(t.razaoSocial ?? t.nome ?? t.nomeFantasia)
    if (name) return name
  }

  return null
}

export type ClienteCatalogByDoc = ReadonlyMap<string, string> | Record<string, string>

export function buildClienteCatalogByDocumento(
  clientes: Array<{ documento?: string | null; nome?: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const item of clientes) {
    const doc = String(item.documento ?? '').replace(/\D/g, '')
    const nome = String(item.nome ?? '').trim()
    if (doc.length >= 11 && nome) map.set(doc, nome)
  }
  return map
}

function lookupNomeNoCatalogo(
  doc: string | null,
  catalogByDoc?: ClienteCatalogByDoc | null,
): string | null {
  if (!doc || !catalogByDoc) return null
  const key = doc.replace(/\D/g, '')
  if (key.length < 11) return null
  if (catalogByDoc instanceof Map) return catalogByDoc.get(key) ?? null
  return catalogByDoc[key] ?? null
}

export function extrairDocumentoTomadorDaNota(record: NfseRecord): string | null {
  const fromColumn = String(record.cnpj_tomador ?? '').replace(/\D/g, '')
  if (fromColumn.length >= 11) return fromColumn

  const sources = [
    resolverPayloadJsonDaNota(record),
    resolverResponseJsonDaNota(record),
  ].filter(Boolean) as Record<string, unknown>[]

  for (const src of sources) {
    const tomador = src.tomador
    if (tomador && typeof tomador === 'object' && !Array.isArray(tomador)) {
      const doc = String((tomador as Record<string, unknown>).cpfCnpj ?? '').replace(/\D/g, '')
      if (doc.length >= 11) return doc
    }
    if (typeof tomador === 'string' || typeof tomador === 'number') {
      const doc = String(tomador).replace(/\D/g, '')
      if (doc.length >= 11) return doc
    }
  }
  return null
}

export function extrairNomeClienteDaNota(
  record: NfseRecord,
  catalogByDoc?: ClienteCatalogByDoc | null,
): string | null {
  const sources = [
    resolverPayloadJsonDaNota(record),
    resolverResponseJsonDaNota(record),
  ].filter(Boolean) as Record<string, unknown>[]
  for (const src of sources) {
    const name = extrairNomeDeObjeto(src, record.document_type)
    if (name && !looksLikeFormattedDocument(name)) return name
  }

  const fromCatalog = lookupNomeNoCatalogo(extrairDocumentoTomadorDaNota(record), catalogByDoc)
  if (fromCatalog) return fromCatalog

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

/** Linha de meta na lista — usa data fiscal (retorno PlugNotas), não created_at enganoso. */
export function formatNotaFiscalEmissaoMeta(
  record: Pick<NfseRecord, 'status' | 'response_json' | 'created_at' | 'updated_at'>,
): string | null {
  const statusKey = getNfseStatusKey(record.status)
  const fiscalDate = resolverDataAutorizacaoFiscalDaNota(record as NfseRecord)

  if (statusKey === 'concluido') {
    if (fiscalDate) return `Autorizada em ${formatDateTime(fiscalDate)}`
    if (record.updated_at) return `Autorizada em ${formatDateTime(record.updated_at)}`
    return null
  }

  if (statusKey === 'processando' || statusKey === 'aguardando') {
    if (record.created_at) return `Enviada em ${formatDateTime(record.created_at)}`
    return null
  }

  if (statusKey === 'rejeitado' || statusKey === 'interrompido') {
    if (record.created_at) return `Tentativa em ${formatDateTime(record.created_at)}`
    return null
  }

  if (fiscalDate) return `Autorizada em ${formatDateTime(fiscalDate)}`
  if (record.created_at) return `Registrada em ${formatDateTime(record.created_at)}`
  return null
}
