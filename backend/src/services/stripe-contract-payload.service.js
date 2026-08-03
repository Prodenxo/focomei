import { env } from '../config/env.js'
import { query } from '../config/pg.js'
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
  if (!url || !payload) {
    return { dispatched: false, reason: 'no_webhook_or_payload' }
  }

  const headers = { 'Content-Type': 'application/json' }
  const secret = str(env.ONETY_CONTRATO_WEBHOOK_SECRET)
  if (secret) {
    headers.Authorization = `Bearer ${secret}`
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.warn('[onety-contrato] webhook falhou', {
      status: response.status,
      body: body.slice(0, 300),
    })
    return { dispatched: false, status: response.status }
  }

  console.info('[onety-contrato] payload enviado ao webhook Onety')
  return { dispatched: true, status: response.status }
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
    return { ok: false, reason: 'payload_unavailable' }
  }

  console.info('[onety-contrato] payload gerado', JSON.stringify(payload))

  const dispatch = await dispatchOnetyContratoPayload(payload)
  return { ok: true, payload, dispatch }
}
