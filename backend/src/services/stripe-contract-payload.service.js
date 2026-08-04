import { env } from '../config/env.js'
import { query } from '../config/pg.js'
import { badRequest } from '../utils/errors.js'
import { isLocalAuthMode } from './local-auth.service.js'
import { resolveMeiPricing } from './mei-billing-pricing.js'

const ONLY_DIGITS = (value) => String(value || '').replace(/\D/g, '')

const normalizePhone55 = (raw) => {
  const digits = ONLY_DIGITS(raw)
  if (!digits) return ''
  if (digits.startsWith('55')) return digits
  return `55${digits}`
}

const str = (value) => String(value ?? '').trim()

const readMeta = (raw) => {
  if (!raw || typeof raw !== 'object') return {}
  return raw
}

/**
 * Monta o JSON de contrato (Onety) a partir de empresa + signatário + linha Stripe.
 * @param {{ empresa: object, signatario?: object|null, meiSlots: number, valorMensal?: number|null }} input
 */
export const buildStripeContratoPayload = ({
  empresa,
  signatario,
  meiSlots,
  valorMensal,
}) => {
  const slots = Number(meiSlots) || 0
  const pricing = resolveMeiPricing(slots)
  const monthly =
    Number(valorMensal) > 0
      ? Number(valorMensal)
      : Number(pricing?.total) || 0

  const meta = readMeta(signatario?.raw_user_meta_data)
  const signatarioNome =
    str(meta.full_name)
    || str(meta.display_name)
    || str(signatario?.display_name)
    || ''
  const signatarioCpf = ONLY_DIGITS(meta.cpf || signatario?.cpf)
  const signatarioEmail = str(signatario?.email) || str(empresa?.email)
  const signatarioTelefone = normalizePhone55(
    signatario?.phone || meta.phone || empresa?.telefone,
  )

  return {
    contratos: [
      {
        tipo_cliente: 'empresa',
        razao_social: str(empresa?.razao_social || empresa?.nome_fantasia || empresa?.empresa),
        cpf_cnpj: ONLY_DIGITS(empresa?.cnpj),
        email: str(empresa?.email),
        telefone: normalizePhone55(empresa?.telefone),
        endereco: str(empresa?.logradouro),
        numero: str(empresa?.numero),
        complemento: str(empresa?.complemento),
        bairro: str(empresa?.bairro),
        cidade: str(empresa?.cidade),
        estado: str(empresa?.estado)?.toUpperCase()?.slice(0, 2) || '',
        cep: ONLY_DIGITS(empresa?.cep),
        signatario_nome: signatarioNome,
        signatario_cpf: signatarioCpf,
        signatario_email: signatarioEmail,
        signatario_telefone: signatarioTelefone,
        quantidade_licencas: String(slots),
        valor_mensal: monthly,
      },
    ],
  }
}

const loadEmpresaRow = async (adminClient, empresaId) => {
  const { data, error } = await adminClient
    .from('empresas')
    .select(
      'id, empresa, cnpj, razao_social, nome_fantasia, logradouro, numero, complemento, bairro, cidade, estado, cep, telefone, email, requested_by',
    )
    .eq('id', empresaId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

const loadSignatarioRow = async (adminClient, userId) => {
  const id = str(userId)
  if (!id) return null

  if (isLocalAuthMode()) {
    const { rows } = await query(
      `SELECT id, email, phone, raw_user_meta_data
       FROM public.users
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    )
    return rows[0] || null
  }

  const { data, error } = await adminClient
    .from('users')
    .select('id, email, phone, raw_user_meta_data')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

const loadSubscriptionLine = async (adminClient, { empresaId, checkoutSessionId, lineId }) => {
  if (lineId) {
    const { data, error } = await adminClient
      .from('empresa_mei_subscription_lines')
      .select('id, mei_slots, value_numeric, status, stripe_checkout_session_id')
      .eq('id', lineId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }

  if (checkoutSessionId) {
    const { data, error } = await adminClient
      .from('empresa_mei_subscription_lines')
      .select('id, mei_slots, value_numeric, status, stripe_checkout_session_id')
      .eq('stripe_checkout_session_id', checkoutSessionId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }

  const { data, error } = await adminClient
    .from('empresa_mei_subscription_lines')
    .select('id, mei_slots, value_numeric, status, stripe_checkout_session_id, updated_at')
    .eq('empresa_id', empresaId)
    .eq('status', 'active')

  if (error) throw new Error(error.message)
  const rows = Array.isArray(data) ? data : []
  if (!rows.length) return null
  rows.sort((a, b) => {
    const ta = new Date(a.updated_at || 0).getTime()
    const tb = new Date(b.updated_at || 0).getTime()
    return tb - ta
  })
  return rows[0]
}

/**
 * Gera payload Onety para uma empresa após pagamento Stripe (ou consulta admin).
 */
export const buildStripeContratoPayloadForEmpresa = async (
  adminClient,
  { empresaId, checkoutSessionId, lineId } = {},
) => {
  const id = str(empresaId)
  if (!id) return null

  const empresa = await loadEmpresaRow(adminClient, id)
  if (!empresa) return null

  const line = await loadSubscriptionLine(adminClient, {
    empresaId: id,
    checkoutSessionId,
    lineId,
  })
  if (!line) return null

  const ownerId = str(empresa.requested_by)
  const signatario = ownerId ? await loadSignatarioRow(adminClient, ownerId) : null

  return buildStripeContratoPayload({
    empresa,
    signatario,
    meiSlots: line.mei_slots,
    valorMensal: line.value_numeric,
  })
}

/**
 * Envia JSON para webhook Onety (robô Python) se configurado.
 */
export const dispatchOnetyContratoPayload = async (payload) => {
  const url = str(env.ONETY_CONTRATO_WEBHOOK_URL)
  if (!payload) {
    return { dispatched: false, reason: 'no_payload' }
  }
  if (!url) {
    console.warn('[onety-contrato] ONETY_CONTRATO_WEBHOOK_URL não configurada — contrato não enviado')
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
    console.warn('[onety-contrato] webhook inacessível', { url, error: message })
    return { dispatched: false, reason: 'webhook_unreachable', error: message, url }
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.warn('[onety-contrato] webhook falhou', {
      url,
      status: response.status,
      body: body.slice(0, 300),
    })
    return {
      dispatched: false,
      reason: 'webhook_http_error',
      status: response.status,
      body: body.slice(0, 300),
      url,
    }
  }

  let responseBody = null
  try {
    responseBody = await response.json()
  } catch {
    responseBody = null
  }

  console.info('[onety-contrato] payload enviado ao webhook Onety', { url, status: response.status })
  return {
    dispatched: true,
    status: response.status,
    url,
    response: responseBody,
  }
}

const contratoDispatchErrorMessage = (dispatch) => {
  const reason = str(dispatch?.reason)
  if (reason === 'webhook_url_not_configured') {
    return (
      'Contrato não enviado: este backend não tem ONETY_CONTRATO_WEBHOOK_URL. '
      + 'Se você está em localhost:3333, use o site em produção ou adicione a variável no backend/.env. '
      + 'Em produção (EasyPanel focomei-backend): salve o Ambiente e faça redeploy do serviço.'
    )
  }
  if (reason === 'webhook_unreachable') {
    return `Robô de contrato inacessível em ${dispatch?.url || 'URL configurada'}: ${dispatch?.error || 'erro de rede'}.`
  }
  if (reason === 'webhook_http_error') {
    return `Robô de contrato respondeu HTTP ${dispatch?.status || '?'}: ${dispatch?.body || 'sem detalhe'}.`
  }
  if (reason === 'no_payload') {
    return 'Payload do contrato vazio.'
  }
  return 'Falha ao enviar contrato ao robô Onety.'
}

/**
 * Monta e envia contrato; lança erro legível quando falha (uso admin / reconciliação manual).
 */
export const emitContratoForEmpresaOrThrow = async (
  adminClient,
  { empresaId, checkoutSessionId, lineId } = {},
) => {
  const result = await emitOnetyContratoAfterStripePayment(adminClient, {
    empresaId,
    checkoutSessionId,
    lineId,
  })

  if (!result.ok) {
    if (result.reason === 'payload_unavailable') {
      throw badRequest(
        'Não foi possível montar o contrato: verifique assinatura MEI ativa, CNPJ/endereço da empresa e dados do signatário.',
      )
    }
    throw badRequest('Não foi possível gerar o contrato.')
  }

  if (!result.dispatch?.dispatched) {
    throw badRequest(contratoDispatchErrorMessage(result.dispatch))
  }

  const onetyOk = result.dispatch?.response?.ok
  if (onetyOk === false) {
    const firstFail = result.dispatch?.response?.resultados?.find((r) => !r?.ok)
    throw badRequest(
      firstFail?.mensagem
        ? `Onety rejeitou o contrato: ${firstFail.mensagem}`
        : 'Onety processou o contrato com falha — veja logs do robo-contrato.',
    )
  }

  return result
}

/**
 * Após checkout Stripe ativo: monta e opcionalmente envia contrato Onety.
 */
export const emitOnetyContratoAfterStripePayment = async (
  adminClient,
  { empresaId, checkoutSessionId, lineId } = {},
) => {
  const payload = await buildStripeContratoPayloadForEmpresa(adminClient, {
    empresaId,
    checkoutSessionId,
    lineId,
  })
  if (!payload) {
    if (lineId && adminClient) {
      try {
        await adminClient
          .from('empresa_mei_subscription_lines')
          .update({
            contrato_status: 'failed',
            contrato_error: 'Não foi possível montar payload do contrato',
            updated_at: new Date().toISOString(),
          })
          .eq('id', lineId)
      } catch {
        // ignore
      }
    }
    return { ok: false, reason: 'payload_unavailable' }
  }

  console.info('[onety-contrato] payload gerado', JSON.stringify(payload))

  const dispatch = await dispatchOnetyContratoPayload(payload)
  const onetyOk = dispatch?.response?.ok !== false
    && !(dispatch?.response?.resultados || []).some((r) => r?.ok === false)

  if (lineId && adminClient) {
    try {
      await adminClient
        .from('empresa_mei_subscription_lines')
        .update({
          contrato_status: dispatch?.dispatched && onetyOk ? 'sent' : 'failed',
          contrato_sent_at: dispatch?.dispatched ? new Date().toISOString() : null,
          contrato_error: dispatch?.dispatched && onetyOk
            ? null
            : (dispatch?.error || dispatch?.response?.resultados?.find((r) => !r?.ok)?.mensagem || 'Falha ao enviar contrato'),
          updated_at: new Date().toISOString(),
        })
        .eq('id', lineId)
    } catch (recordErr) {
      console.warn('[onety-contrato] falha ao gravar status na linha', recordErr)
    }
  }

  return { ok: true, payload, dispatch }
}
