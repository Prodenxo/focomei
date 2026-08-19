import { env } from '../config/env.js'
import {
  getFunilById,
  listFunisDisponiveis,
  ONETY_EMPRESA_ID,
} from '../config/onety-crm-funis.js'
import { badRequest } from '../utils/errors.js'
import { resolveContratoSignatarioForEmpresa } from './stripe-contract-payload.service.js'

const str = (value) => String(value ?? '').trim()
const ONLY_DIGITS = (value) => String(value || '').replace(/\D/g, '')

/** Telefone local para CRM Onety (sem prefixo 55 quando possível). */
const telefoneLocalOnety = (raw) => {
  const digits = ONLY_DIGITS(raw)
  if (!digits) return ''
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits.slice(2)
  }
  return digits
}

export const listOnetyCrmFunis = () => listFunisDisponiveis()

const resolveCrmWebhookUrl = () => {
  const explicit = str(env.ONETY_CRM_WEBHOOK_URL)
  if (explicit) return explicit

  const contratoUrl = str(env.ONETY_CONTRATO_WEBHOOK_URL)
  if (contratoUrl.includes('/webhook/contrato')) {
    return contratoUrl.replace(/\/webhook\/contrato\/?$/, '/webhook/crm/preparar-proposta')
  }
  return ''
}

const getDefaultVendedorId = () => {
  const raw = str(env.ONETY_CRM_DEFAULT_VENDEDOR_ID)
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1083
}

/**
 * Monta payload do webhook CRM a partir da empresa + funil selecionado.
 */
export const buildCrmLeadPayloadForEmpresa = async (
  adminClient,
  { empresaId, funilId, vendedorId, valor } = {},
) => {
  const funil = getFunilById(funilId)
  if (!funil) {
    throw badRequest('Funil comercial inválido.')
  }
  if (!funil.faseLeadId || !funil.fasePropostaId) {
    throw badRequest(
      `Funil "${funil.name}" ainda não tem fases Lead/Proposta configuradas. `
      + 'Atualize backend/src/config/onety-crm-funis.js.',
    )
  }

  const { data: empresa, error } = await adminClient
    .from('empresas')
    .select('id, empresa, razao_social, nome_fantasia, telefone, email')
    .eq('id', empresaId)
    .maybeSingle()

  if (error) throw badRequest(error.message)
  if (!empresa) throw badRequest('Empresa não encontrada.')

  const signatario = await resolveContratoSignatarioForEmpresa(adminClient, empresaId)

  const nome =
    str(empresa.razao_social)
    || str(empresa.nome_fantasia)
    || str(empresa.empresa)
    || str(signatario?.displayName)
    || 'Lead FocoMEI'

  const email = str(signatario?.email) || str(empresa.email)
  if (!email) {
    throw badRequest(
      'E-mail obrigatório para criar lead no CRM: vincule admin com e-mail ou preencha contato da empresa.',
    )
  }

  const telefone = telefoneLocalOnety(empresa.telefone)
  const valorNum = Number(valor)
  const valorFinal = Number.isFinite(valorNum) && valorNum > 0 ? valorNum : null

  const vendedorRaw = Number(vendedorId)
  const usuarioId =
    Number.isFinite(vendedorRaw) && vendedorRaw > 0
      ? vendedorRaw
      : getDefaultVendedorId()

  return {
    nome,
    telefone: telefone || '0000000000',
    email,
    data_prevista: null,
    funil_id: funil.id,
    funil_fase_id_lead: funil.faseLeadId,
    funil_fase_id_proposta: funil.fasePropostaId,
    usuario_id: usuarioId,
    pre_venda_id: null,
    empresa_id: ONETY_EMPRESA_ID,
    valor: valorFinal,
    status: 'aberto',
    _meta: {
      funil_name: funil.name,
      empresa_id_focomei: str(empresaId),
    },
  }
}

export const dispatchOnetyCrmPrepararProposta = async (payload) => {
  const url = resolveCrmWebhookUrl()
  if (!payload) {
    return { dispatched: false, reason: 'no_payload' }
  }
  if (!url) {
    console.warn('[onety-crm] webhook CRM não configurado (ONETY_CRM_WEBHOOK_URL ou ONETY_CONTRATO_WEBHOOK_URL)')
    return { dispatched: false, reason: 'webhook_url_not_configured' }
  }

  const headers = { 'Content-Type': 'application/json' }
  const secret = str(env.ONETY_CONTRATO_WEBHOOK_SECRET)
  if (secret) {
    headers.Authorization = `Bearer ${secret}`
  }

  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn('[onety-crm] webhook inacessível', { url, error: message })
    return { dispatched: false, reason: 'webhook_unreachable', error: message, url }
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.warn('[onety-crm] webhook falhou', { url, status: response.status, body: body.slice(0, 500) })
    return {
      dispatched: false,
      reason: 'webhook_http_error',
      status: response.status,
      body: body.slice(0, 2000),
      url,
    }
  }

  let responseBody = null
  try {
    responseBody = await response.json()
  } catch {
    responseBody = null
  }

  console.info('[onety-crm] lead preparado no CRM', {
    url,
    leadId: responseBody?.leadId,
    funil: payload?.funil_id,
  })

  return {
    dispatched: true,
    status: response.status,
    url,
    response: responseBody,
  }
}

const crmDispatchErrorMessage = (dispatch) => {
  const reason = str(dispatch?.reason)
  if (reason === 'webhook_url_not_configured') {
    return (
      'CRM não enviado: configure ONETY_CRM_WEBHOOK_URL ou ONETY_CONTRATO_WEBHOOK_URL no backend.'
    )
  }
  if (reason === 'webhook_unreachable') {
    return `Robô CRM inacessível: ${dispatch?.error || 'erro de rede'}.`
  }
  if (reason === 'webhook_http_error') {
    const detail = dispatch?.body || dispatch?.response?.error
    return detail
      ? `Robô CRM falhou: ${detail}`
      : `Robô CRM respondeu HTTP ${dispatch?.status || '?'}.`
  }
  return 'Falha ao preparar lead no CRM Onety.'
}

/**
 * Cria lead e move para Proposta via robô Python.
 */
export const prepararPropostaCrmForEmpresaOrThrow = async (
  adminClient,
  { empresaId, funilId, vendedorId, valor } = {},
) => {
  const payload = await buildCrmLeadPayloadForEmpresa(adminClient, {
    empresaId,
    funilId,
    vendedorId,
    valor,
  })

  const { _meta, ...webhookBody } = payload
  const dispatch = await dispatchOnetyCrmPrepararProposta(webhookBody)

  if (!dispatch?.dispatched) {
    throw badRequest(crmDispatchErrorMessage(dispatch))
  }

  if (dispatch?.response?.ok === false) {
    throw badRequest(
      str(dispatch.response?.error)
      || str(dispatch.response?.message)
      || 'Onety rejeitou a preparação do lead no CRM.',
    )
  }

  return { ok: true, payload: webhookBody, dispatch, meta: _meta }
}
