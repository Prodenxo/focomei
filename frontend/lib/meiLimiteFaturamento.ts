import type { NfseRecord } from '../services/meiNotasService'
import type { MeiLimiteThresholds } from './meiLimiteFaturamentoConfig'
import {
  DEFAULT_MEI_LIMITE_THRESHOLDS,
  getLimiteReferenciaReaisParaAno,
} from './meiLimiteFaturamentoConfig'

export type MeiLimiteBanda = 'seguro' | 'atencao' | 'critico'
export type MeiLimiteBandaOuIndeterminado = MeiLimiteBanda | 'indeterminado'

export interface MeiLimiteProgresso {
  anoCivil: number
  totalUtilizadoReais: number
  limiteReferenciaReais: number | null
  percentualUtilizado: number | null
  percentualUtilizadoParaBarra: number | null
  banda: MeiLimiteBandaOuIndeterminado
  notasConsideradas: number
}

export const MEI_LIMITE_ANO_CIVIL_TZ = 'America/Sao_Paulo'

export interface ComputeMeiLimiteProgressoOptions {
  anoCivil: number
  limiteReferenciaReaisOverride?: number | null
  thresholds?: MeiLimiteThresholds
  agregadoServidor?: { totalUtilizadoReais: number; notasConsideradas: number }
}

function nfseStatusAsciiLower(status?: string | null): string {
  return String(status || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

export function nfseStatusKeyParaLimite(status?: string | null): string {
  const text = String(status || '').toLowerCase()
  const ascii = nfseStatusAsciiLower(status)
  if (!ascii) return 'processando'
  if (ascii.includes('cancelamento_pendente') || (ascii.includes('cancelamento') && ascii.includes('pendente'))) {
    return 'cancelamento_pendente'
  }
  if (ascii.includes('concluido') || ascii.includes('concluida') || ascii.includes('autoriz')) {
    return 'concluido'
  }
  if (ascii.includes('process')) return 'processando'
  if (ascii.includes('rejeit')) return 'rejeitado'
  if (ascii.includes('cancel')) return 'cancelado'
  if (ascii.includes('interromp')) return 'interrompido'
  return text
}

export function nfseDeveEntrarNoSomatórioLimite(status?: string | null): boolean {
  return nfseStatusKeyParaLimite(status) === 'concluido'
}

export function parseValorMonetarioBr(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  let s = String(value).trim().replace(/\u00a0/g, '')
  if (!s) return null
  s = s.replace(/^R\$\s*/i, '')
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && (!hasDot || s.lastIndexOf(',') > s.lastIndexOf('.'))) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma && hasDot) {
    s = s.replace(/,/g, '')
  } else if (hasComma) {
    s = s.replace(',', '.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function normalizarPayloadJsonNfse(input: unknown): Record<string, unknown> | null {
  if (input === null || input === undefined) return null
  let current: unknown = input
  for (let depth = 0; depth < 6; depth += 1) {
    if (typeof current === 'string') {
      const t = current.trim()
      if (!t) return null
      try {
        current = JSON.parse(t) as unknown
        continue
      } catch {
        return null
      }
    }
    if (Array.isArray(current) && current.length === 1) {
      current = current[0]
      continue
    }
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return current as Record<string, unknown>
    }
    return null
  }
  return null
}

export function resolverPayloadJsonDaNota(record: NfseRecord): Record<string, unknown> | null {
  const r = record as Record<string, unknown>
  const raw = r.payload_json ?? r.payloadJson
  return normalizarPayloadJsonNfse(raw)
}

export function resolverResponseJsonDaNota(record: NfseRecord): Record<string, unknown> | null {
  const r = record as Record<string, unknown>
  const raw = r.response_json ?? r.responseJson
  return normalizarPayloadJsonNfse(raw)
}

const FISCAL_AUTH_DATE_FIELD_KEYS = [
  'dataAutorizacao',
  'dataAutorizacaoNfse',
] as const

const FISCAL_EMISSION_DATE_FIELD_KEYS = [
  'dataEmissao',
  'data_emissao',
  'emissao',
] as const

const FISCAL_DATE_FIELD_KEYS = [
  ...FISCAL_AUTH_DATE_FIELD_KEYS,
  ...FISCAL_EMISSION_DATE_FIELD_KEYS,
] as const

/** Fuso fixo do Brasil (sem horário de verão desde 2019). */
const BR_UTC_OFFSET = '-03:00'
const BR_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/

/** A PlugNotas envia dd/mm/aaaa; `new Date` leria como mm/dd/aaaa e trocaria dia por mês. */
export function parseDataBrIso(value: unknown): string | null {
  const match = BR_DATE_RE.exec(String(value ?? '').trim())
  if (!match) return null
  const [, d, m, y, h = '0', min = '0', s = '0'] = match
  const dia = Number(d)
  const mes = Number(m)
  if (!(mes >= 1 && mes <= 12) || !(dia >= 1 && dia <= 31)) return null
  const pad = (n: string | number) => String(Number(n)).padStart(2, '0')
  const parsed = new Date(
    `${y}-${pad(mes)}-${pad(dia)}T${pad(h)}:${pad(min)}:${pad(s)}${BR_UTC_OFFSET}`,
  )
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function parseDateIso(value: unknown): string | null {
  if (value == null || value === '') return null
  const fromBr = parseDataBrIso(value)
  if (fromBr) return fromBr
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function pickFirstDateFromObject(
  obj: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const iso = parseDateIso(obj[key])
    if (iso) return iso
  }
  return null
}

function pickFirstAuthDateFromObject(obj: Record<string, unknown>): string | null {
  return pickFirstDateFromObject(obj, FISCAL_AUTH_DATE_FIELD_KEYS)
}

function pickFirstEmissionDateFromObject(obj: Record<string, unknown>): string | null {
  return pickFirstDateFromObject(obj, FISCAL_EMISSION_DATE_FIELD_KEYS)
}

/** Timestamp embutido em id_integracao FocoMEI (`mei-{userId}-{Date.now()}-…`). */
export function parseCreatedAtIsoFromIdIntegracao(
  idIntegracao: string | null | undefined,
): string | null {
  const raw = String(idIntegracao ?? '').trim()
  if (!raw.startsWith('mei-')) return null
  const match = raw.match(/-(\d{13})(?:-|$)/)
  if (!match) return null
  const ms = Number(match[1])
  if (!Number.isFinite(ms) || ms < 1e12 || ms > 9.9e12) return null
  return new Date(ms).toISOString()
}

function pickFirstAuthDateFromResponse(response: Record<string, unknown>): string | null {
  for (const candidate of collectResponseCandidates(response)) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const iso = pickFirstAuthDateFromObject(candidate as Record<string, unknown>)
    if (iso) return iso
  }
  return null
}

function pickFirstEmissionDateFromResponse(response: Record<string, unknown>): string | null {
  for (const candidate of collectResponseCandidates(response)) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const iso = pickFirstEmissionDateFromObject(candidate as Record<string, unknown>)
    if (iso) return iso
  }
  return null
}

/** Mesma heurística do backend (`collectResponseCandidates` em mei-notas.service). */
export function collectResponseCandidates(response: unknown): unknown[] {
  if (Array.isArray(response)) return response
  if (!response || typeof response !== 'object') return [response]
  const r = response as Record<string, unknown>
  const list: unknown[] = [r]
  if (Array.isArray(r.documents)) list.push(...r.documents)
  if (Array.isArray(r.documentos)) list.push(...r.documentos)
  if (r.data !== undefined && r.data !== null) {
    if (Array.isArray(r.data)) list.push(...r.data)
    else if (typeof r.data === 'object') list.push(r.data)
  }
  if (r.nfse && typeof r.nfse === 'object') list.push(r.nfse)
  if (r.documento && typeof r.documento === 'object') list.push(r.documento)
  if (r.retorno && typeof r.retorno === 'object') list.push(r.retorno)
  if (r.xml && typeof r.xml === 'object') {
    list.push(r.xml)
    const xml = r.xml as Record<string, unknown>
    if (xml.retorno && typeof xml.retorno === 'object') list.push(xml.retorno)
  }
  return list
}

/** Data de autorização fiscal (PlugNotas) — sem fallback em created_at ou competência. */
export function resolverDataAutorizacaoFiscalDaNota(record: NfseRecord): string | null {
  const resp = resolverResponseJsonDaNota(record)
  if (!resp) return null
  return pickFirstAuthDateFromResponse(resp)
}

/** Data para exibição "Emitida em": autorização → criação FocoMEI → created_at. */
export function resolverDataExibicaoEmissaoDaNota(record: NfseRecord): string | null {
  const auth = resolverDataAutorizacaoFiscalDaNota(record)
  if (auth) return auth
  const fromIntegracao = parseCreatedAtIsoFromIdIntegracao(record.id_integracao)
  if (fromIntegracao) return fromIntegracao
  return parseDateIso(record.created_at)
}

function notaListaOrdenacaoMs(record: Pick<NfseRecord, 'response_json' | 'id_integracao' | 'created_at' | 'updated_at'>): number {
  const iso = resolverDataExibicaoEmissaoDaNota(record as NfseRecord)
    || parseDateIso(record.updated_at)
    || parseDateIso(record.created_at)
  if (!iso) return 0
  const ms = new Date(iso).getTime()
  return Number.isFinite(ms) ? ms : 0
}

/** Ordena notas pela mesma data exibida na lista (mais recente primeiro). */
export function sortNotasPorListaRecencia<T extends Pick<NfseRecord, 'id' | 'response_json' | 'id_integracao' | 'created_at' | 'updated_at'>>(
  rows: T[],
): T[] {
  if (rows.length < 2) return rows
  return [...rows].sort((a, b) => {
    const diff = notaListaOrdenacaoMs(b) - notaListaOrdenacaoMs(a)
    if (diff !== 0) return diff
    const updatedDiff = notaListaOrdenacaoMs({ ...b, created_at: b.updated_at })
      - notaListaOrdenacaoMs({ ...a, created_at: a.updated_at })
    if (updatedDiff !== 0) return updatedDiff
    return String(b.id ?? '').localeCompare(String(a.id ?? ''))
  })
}

function hasServicoArrayInObj(obj: Record<string, unknown>): boolean {
  const s = obj.servico ?? obj.servicos
  return s != null
}

function hasItensArrayInObj(obj: Record<string, unknown>): boolean {
  const i = obj.itens ?? obj.items
  return i != null
}

/** NFS-e e NF-e contam no limite MEI; NFC-e fica de fora. */
export function isDocumentTypeMeiLimiteRelevante(documentType: string | null | undefined): boolean {
  const dt = String(documentType ?? '').trim().toUpperCase()
  return dt === 'NFSE' || dt === 'NFE'
}

export function isNfseDocumento(record: NfseRecord): boolean {
  const dt = String(record.document_type ?? '').trim().toUpperCase()
  if (dt !== '') return dt === 'NFSE'
  const p = resolverPayloadJsonDaNota(record)
  if (p && hasServicoArrayInObj(p)) return true
  const resp = resolverResponseJsonDaNota(record)
  return Boolean(resp && hasServicoArrayInObj(resp))
}

/** Nota que entra no somatório: NFS-e, NF-e ou legado sem tipo. */
export function isDocumentoLimiteMei(record: NfseRecord): boolean {
  const dt = String(record.document_type ?? '').trim()
  if (dt !== '') return isDocumentTypeMeiLimiteRelevante(dt)
  const p = resolverPayloadJsonDaNota(record)
  if (p && (hasServicoArrayInObj(p) || hasItensArrayInObj(p))) return true
  const resp = resolverResponseJsonDaNota(record)
  return Boolean(resp && (hasServicoArrayInObj(resp) || hasItensArrayInObj(resp)))
}

function valorLimiteDeItemServico(item: Record<string, unknown>): number | null {
  const valor = item.valor
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    const v = valor as { liquido?: unknown; servico?: unknown }
    const liq = parseValorMonetarioBr(v.liquido)
    if (liq !== null && liq >= 0) return liq
    const serv = parseValorMonetarioBr(v.servico)
    if (serv !== null && serv >= 0) return serv
  }
  const flat =
    item.valorServico
    ?? (item as { valorServiço?: unknown }).valorServiço
    ?? (item as { valor_servico?: unknown }).valor_servico
  const n2 = parseValorMonetarioBr(flat)
  if (n2 !== null && n2 >= 0) return n2
  return null
}

export function extrairValorTotalServicosDeObjeto(raw: Record<string, unknown> | null): number | null {
  if (!raw) return null
  const topLevel = parseValorMonetarioBr(
    raw.valorServico ?? raw.valorTotal ?? raw.valorNfse ?? raw.valor,
  )
  if (topLevel !== null && topLevel >= 0) return topLevel
  let servicos = raw.servico ?? raw.servicos
  if (servicos && !Array.isArray(servicos)) {
    servicos = [servicos]
  }
  if (!Array.isArray(servicos)) return null
  let sum = 0
  let any = false
  for (const item of servicos) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const n = valorLimiteDeItemServico(item as Record<string, unknown>)
    if (n !== null) {
      sum += n
      any = true
    }
  }
  return any ? sum : null
}

export function extrairValorLimiteMeiDaNota(record: NfseRecord): number | null {
  const resp = resolverResponseJsonDaNota(record)
  if (resp) {
    const fromResp = extrairValorTotalServicosDeObjeto(resp)
    if (fromResp !== null) return fromResp
  }
  const payload = resolverPayloadJsonDaNota(record)
  return extrairValorTotalServicosDeObjeto(payload)
}

function valorUnitarioDeItemProduto(item: Record<string, unknown>): number | null {
  const vu = item.valorUnitario
  if (vu && typeof vu === 'object' && !Array.isArray(vu)) {
    const v = vu as { comercial?: unknown; tributavel?: unknown }
    const c = parseValorMonetarioBr(v.comercial)
    if (c !== null && c >= 0) return c
    const t = parseValorMonetarioBr(v.tributavel)
    if (t !== null && t >= 0) return t
  }
  return parseValorMonetarioBr(vu)
}

function quantidadeDeItemProduto(item: Record<string, unknown>): number | null {
  const q = item.quantidade
  if (q && typeof q === 'object' && !Array.isArray(q)) {
    const v = q as { comercial?: unknown; tributavel?: unknown }
    const c = parseValorMonetarioBr(v.comercial)
    if (c !== null && c >= 0) return c
    const t = parseValorMonetarioBr(v.tributavel)
    if (t !== null && t >= 0) return t
  }
  return parseValorMonetarioBr(q)
}

function valorLimiteDeItemProduto(item: Record<string, unknown>): number | null {
  const direct = parseValorMonetarioBr(item.valor)
  if (direct !== null && direct >= 0) return direct
  const quantidade = quantidadeDeItemProduto(item)
  const unitario = valorUnitarioDeItemProduto(item)
  if (quantidade !== null && unitario !== null) {
    const total = quantidade * unitario
    return Number.isFinite(total) && total >= 0 ? total : null
  }
  return null
}

/** Total de uma NF-e: valor autorizado no retorno ou a soma dos itens do payload. */
export function extrairValorTotalProdutosDeObjeto(
  raw: Record<string, unknown> | null,
): number | null {
  if (!raw) return null
  const topLevel = parseValorMonetarioBr(raw.valorTotal ?? raw.valorNota ?? raw.valor)
  if (topLevel !== null && topLevel >= 0) return topLevel
  let itens = raw.itens ?? raw.items
  if (itens && !Array.isArray(itens)) {
    itens = [itens]
  }
  if (!Array.isArray(itens)) return null
  let sum = 0
  let any = false
  for (const item of itens) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const n = valorLimiteDeItemProduto(item as Record<string, unknown>)
    if (n !== null) {
      sum += n
      any = true
    }
  }
  return any ? sum : null
}

function extrairValorProdutosDaNota(record: NfseRecord): number | null {
  const resp = resolverResponseJsonDaNota(record)
  if (resp) {
    const fromResp = extrairValorTotalProdutosDeObjeto(resp)
    if (fromResp !== null) return fromResp
  }
  return extrairValorTotalProdutosDeObjeto(resolverPayloadJsonDaNota(record))
}

/** Valor que a nota soma no limite, conforme o modelo do documento. */
export function extrairValorParaLimiteMei(record: NfseRecord): number | null {
  const dt = String(record.document_type ?? '').trim().toUpperCase()
  if (dt === 'NFE') return extrairValorProdutosDaNota(record)
  if (dt === 'NFSE') return extrairValorLimiteMeiDaNota(record)
  return extrairValorLimiteMeiDaNota(record) ?? extrairValorProdutosDaNota(record)
}

export function anoCivilFromIsoCreatedAt(createdAt: string | undefined | null): number | null {
  if (!createdAt) return null
  const parsed = new Date(createdAt)
  if (Number.isNaN(parsed.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MEI_LIMITE_ANO_CIVIL_TZ,
    year: 'numeric',
  }).formatToParts(parsed)
  const y = parts.find((p) => p.type === 'year')?.value
  if (!y) return null
  const n = parseInt(y, 10)
  return Number.isFinite(n) ? n : null
}

export function resolverDataEmissaoDaNota(record: NfseRecord): string | null {
  const fiscal = resolverDataAutorizacaoFiscalDaNota(record)
  if (fiscal) return fiscal
  const resp = resolverResponseJsonDaNota(record)
  if (resp) {
    const competencia = pickFirstEmissionDateFromResponse(resp)
    if (competencia) return competencia
  }
  const fromIntegracao = parseCreatedAtIsoFromIdIntegracao(record.id_integracao)
  if (fromIntegracao) return fromIntegracao
  const r = record as Record<string, unknown>
  return parseDateIso(record.created_at) ?? parseDateIso(r.createdAt)
}

export function somarNotasAutorizadasNoAnoCivil(
  records: NfseRecord[],
  options: { anoCivil: number },
): { total: number; notasConsideradas: number } {
  const { anoCivil } = options
  let total = 0
  let notasConsideradas = 0
  for (const record of records) {
    if (!isDocumentoLimiteMei(record)) continue
    if (!nfseDeveEntrarNoSomatórioLimite(record.status)) continue
    const y = anoCivilFromIsoCreatedAt(resolverDataEmissaoDaNota(record))
    if (y !== anoCivil) continue
    const valor = extrairValorParaLimiteMei(record)
    if (valor === null) continue
    total += valor
    notasConsideradas += 1
  }
  return { total, notasConsideradas }
}

function clampBarPercent(raw: number): number {
  if (!Number.isFinite(raw)) return 0
  return Math.min(100, Math.max(0, raw))
}

function resolveBanda(
  percentual: number | null,
  thresholds: MeiLimiteThresholds,
): MeiLimiteBandaOuIndeterminado {
  if (percentual === null || !Number.isFinite(percentual)) return 'indeterminado'
  if (percentual >= thresholds.criticoMinPercent) return 'critico'
  if (percentual >= thresholds.atencaoMinPercent) return 'atencao'
  return 'seguro'
}

export function computeMeiLimiteProgresso(
  records: NfseRecord[],
  options: ComputeMeiLimiteProgressoOptions,
): MeiLimiteProgresso {
  const thresholds = options.thresholds ?? DEFAULT_MEI_LIMITE_THRESHOLDS
  let total: number
  let notasConsideradas: number
  if (options.agregadoServidor !== undefined) {
    total = options.agregadoServidor.totalUtilizadoReais
    notasConsideradas = options.agregadoServidor.notasConsideradas
    const local = somarNotasAutorizadasNoAnoCivil(records, { anoCivil: options.anoCivil })
    if (local.notasConsideradas === 0 && total > 0) {
      total = 0
      notasConsideradas = 0
    } else if (notasConsideradas === 0 && local.notasConsideradas > 0) {
      total = local.total
      notasConsideradas = local.notasConsideradas
    }
  } else {
    const s = somarNotasAutorizadasNoAnoCivil(records, { anoCivil: options.anoCivil })
    total = s.total
    notasConsideradas = s.notasConsideradas
  }

  let limite: number | null
  if (options.limiteReferenciaReaisOverride !== undefined) {
    limite = options.limiteReferenciaReaisOverride
  } else {
    limite = getLimiteReferenciaReaisParaAno(options.anoCivil)
  }

  let percentual: number | null = null
  let paraBarra: number | null = null
  if (limite !== null && limite > 0) {
    percentual = (total / limite) * 100
    paraBarra = clampBarPercent(percentual)
  } else if (limite === 0) {
    percentual = null
    paraBarra = null
  }

  const banda =
    limite === null || limite <= 0
      ? 'indeterminado'
      : resolveBanda(percentual, thresholds)

  return {
    anoCivil: options.anoCivil,
    totalUtilizadoReais: total,
    limiteReferenciaReais: limite,
    percentualUtilizado: percentual,
    percentualUtilizadoParaBarra: paraBarra,
    banda,
    notasConsideradas,
  }
}
