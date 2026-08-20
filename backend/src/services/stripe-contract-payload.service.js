import { env } from '../config/env.js'
import { query } from '../config/pg.js'
import { badRequest } from '../utils/errors.js'
import { isValidCpf, formatCpfDisplay } from '../utils/cpf-cnpj.js'
import { isLocalAuthMode } from './local-auth.service.js'
import { resolveMeiPricing } from './mei-billing-pricing.js'
import { updateMeiSubscriptionLine } from './mei-line-approval-columns.service.js'

const ONLY_DIGITS = (value) => String(value || '').replace(/\D/g, '')

const normalizePhone55 = (raw) => {
  const digits = ONLY_DIGITS(raw)
  if (!digits) return ''
  if (digits.startsWith('55')) return digits
  return `55${digits}`
}

const str = (value) => String(value ?? '').trim()

const extractEmpresaCnpjDigits = (empresa) => {
  const direct = ONLY_DIGITS(empresa?.cnpj)
  if (direct.length === 14) return direct

  const haystack = [
    empresa?.razao_social,
    empresa?.nome_fantasia,
    empresa?.empresa,
  ]
    .filter(Boolean)
    .join(' ')

  const formatted = haystack.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/)
  if (formatted?.[0]) {
    const digits = ONLY_DIGITS(formatted[0])
    if (digits.length === 14) return digits
  }

  const loose = ONLY_DIGITS(haystack)
  if (loose.length >= 14) return loose.slice(0, 14)
  return direct
}

export const validateContratoPayload = (payload) => {
  const contrato = payload?.contratos?.[0]
  if (!contrato) return ['Payload do contrato vazio']

  const errors = []
  const cnpj = ONLY_DIGITS(contrato.cpf_cnpj)
  if (cnpj.length !== 14) {
    errors.push(
      `CNPJ inválido no envio ao Onety (${cnpj.length || 0} dígitos). Confira o campo CNPJ na empresa.`,
    )
  }

  const emailEmpresa = str(contrato.email)
  const emailSignatario = str(contrato.signatario_email)
  if (!emailEmpresa && !emailSignatario) {
    errors.push(
      'Falta e-mail para o contrato: preencha "Contato → E-mail" na empresa ou vincule um admin com e-mail.',
    )
  }

  const nome = str(contrato.signatario_nome) || str(contrato.razao_social)
  if (!nome) {
    errors.push('Nome do signatário ou razão social da empresa é obrigatório.')
  }

  const signatarioCpf = ONLY_DIGITS(contrato.signatario_cpf)
  if (!signatarioCpf || !isValidCpf(signatarioCpf)) {
    errors.push(
      'CPF do signatário inválido ou ausente. O admin da empresa precisa ter CPF cadastrado no perfil (cadastro ou ajuste manual).',
    )
  }

  return errors
}

const parseOnetyWebhookFailureMessage = (dispatch) => {
  const rawBody = str(dispatch?.body)
  if (!rawBody) return null

  try {
    const parsed = JSON.parse(rawBody)
    const resultados = Array.isArray(parsed?.resultados) ? parsed.resultados : []
    const firstFail = resultados.find((item) => item?.ok === false)
    if (firstFail?.mensagem) return String(firstFail.mensagem)

    if (parsed?.error) return String(parsed.error)
    if (parsed?.message) return String(parsed.message)
  } catch {
    // body não é JSON
  }

  return rawBody.length > 280 ? `${rawBody.slice(0, 280)}…` : rawBody
}

const readMeta = (raw) => {
  if (!raw || typeof raw !== 'object') return {}
  return raw
}

/** Une requested_by + admin da empresa (CPF/nome do contato primário quando o owner não tem). */
export const mergeSignatarioProfiles = (owner, contact) => {
  if (!owner && !contact) return null
  if (!owner) return contact
  if (!contact) return owner

  const ownerMeta = readMeta(owner.raw_user_meta_data)
  const contactMeta = readMeta(contact.raw_user_meta_data)
  const mergedMeta = {
    ...contactMeta,
    ...ownerMeta,
    cpf: ONLY_DIGITS(ownerMeta.cpf || contactMeta.cpf),
    full_name:
      str(ownerMeta.full_name)
      || str(contactMeta.full_name)
      || str(ownerMeta.display_name)
      || str(contactMeta.display_name),
    display_name:
      str(ownerMeta.display_name)
      || str(contactMeta.display_name)
      || str(ownerMeta.full_name)
      || str(contactMeta.full_name),
    phone: str(ownerMeta.phone) || str(contactMeta.phone) || null,
  }

  return {
    ...contact,
    ...owner,
    email: str(owner.email) || str(contact.email),
    phone: str(owner.phone) || str(contact.phone) || null,
    raw_user_meta_data: mergedMeta,
  }
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
  onetyLeadId,
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
  const signatarioCpfDigits = ONLY_DIGITS(meta.cpf || signatario?.cpf)
  const signatarioCpf = formatCpfDisplay(signatarioCpfDigits)
  const signatarioEmail = str(signatario?.email) || str(empresa?.email)
  const signatarioTelefone = normalizePhone55(
    signatario?.phone || meta.phone || empresa?.telefone,
  )

  const leadIdNum = Number(onetyLeadId)
  const onetyLeadIdFinal =
    Number.isFinite(leadIdNum) && leadIdNum > 0 ? leadIdNum : null

  const contratoItem = {
    tipo_cliente: 'empresa',
    razao_social: str(empresa?.razao_social || empresa?.nome_fantasia || empresa?.empresa),
    cpf_cnpj: extractEmpresaCnpjDigits(empresa),
    email: str(empresa?.email) || str(signatario?.email),
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
  }

  if (onetyLeadIdFinal) {
    contratoItem.onety_lead_id = onetyLeadIdFinal
  }

  return {
    contratos: [contratoItem],
    ...(onetyLeadIdFinal ? { onety_lead_id: onetyLeadIdFinal } : {}),
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

const loadEmpresaPrimaryContact = async (adminClient, empresaId) => {
  const id = str(empresaId)
  if (!id) return null

  if (isLocalAuthMode()) {
    const { rows } = await query(
      `SELECT u.id, u.email, u.phone, u.raw_user_meta_data
       FROM public.role_x_user_x_empresa rx
       JOIN public.roles r ON r.id = rx.roles_id
       JOIN public.users u ON u.id = rx.user_id
       WHERE rx.empresas_id = $1
         AND COALESCE(rx.status, true) = true
         AND u.deleted_at IS NULL
       ORDER BY
         CASE
           WHEN lower(r.roles) = 'admin' THEN 0
           WHEN lower(r.roles) IN ('usuario', 'user') THEN 1
           ELSE 2
         END,
         rx.created_at DESC
       LIMIT 1`,
      [id],
    )
    return rows[0] || null
  }

  const { data: links, error: linkErr } = await adminClient
    .from('role_x_user_x_empresa')
    .select('user_id, roles_id, created_at')
    .eq('empresas_id', id)
    .eq('status', true)
    .order('created_at', { ascending: false })
    .limit(20)

  if (linkErr || !links?.length) return null

  const roleIds = [...new Set(links.map((l) => l.roles_id).filter(Boolean))]
  const { data: roles } = await adminClient
    .from('roles')
    .select('id, roles')
    .in('id', roleIds.length ? roleIds : ['00000000-0000-0000-0000-000000000000'])

  const roleRank = new Map(
    (roles || []).map((r) => [
      r.id,
      String(r.roles || '').toLowerCase() === 'admin' ? 0 : 1,
    ]),
  )

  const sortedLinks = [...links].sort((a, b) => {
    const rankA = roleRank.get(a.roles_id) ?? 2
    const rankB = roleRank.get(b.roles_id) ?? 2
    if (rankA !== rankB) return rankA - rankB
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  })

  for (const link of sortedLinks) {
    const user = await loadSignatarioRow(adminClient, link.user_id)
    if (user?.email) return user
  }

  return null
}

/**
 * Resolve o signatário do contrato (mesma lógica do payload Onety).
 * @returns {Promise<{ userId: string, displayName: string, email: string, cpfCadastrado: boolean } | null>}
 */
export const resolveContratoSignatarioForEmpresa = async (adminClient, empresaId) => {
  const id = str(empresaId)
  if (!id) return null

  const empresa = await loadEmpresaRow(adminClient, id)
  if (!empresa) return null

  const ownerId = str(empresa.requested_by)
  const owner = ownerId ? await loadSignatarioRow(adminClient, ownerId) : null
  const primaryContact = await loadEmpresaPrimaryContact(adminClient, id)
  const signatario = mergeSignatarioProfiles(owner, primaryContact)
  if (!signatario?.id) return null

  const meta = readMeta(signatario.raw_user_meta_data)
  const cpfDigits = ONLY_DIGITS(meta.cpf)
  const userId = str(owner?.id) || str(primaryContact?.id) || str(signatario.id)

  return {
    userId,
    displayName:
      str(meta.full_name)
      || str(meta.display_name)
      || str(signatario.display_name)
      || '',
    email: str(signatario.email) || str(empresa.email) || '',
    cpfCadastrado: Boolean(cpfDigits && isValidCpf(cpfDigits)),
  }
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
  { empresaId, checkoutSessionId, lineId, onetyLeadId } = {},
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
  const owner = ownerId ? await loadSignatarioRow(adminClient, ownerId) : null
  const primaryContact = await loadEmpresaPrimaryContact(adminClient, id)
  const signatario = mergeSignatarioProfiles(owner, primaryContact)

  return buildStripeContratoPayload({
    empresa,
    signatario,
    meiSlots: line.mei_slots,
    valorMensal: line.value_numeric,
    onetyLeadId,
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
    const parsedDetail = parseOnetyWebhookFailureMessage({ body })
    console.warn('[onety-contrato] webhook falhou', {
      url,
      status: response.status,
      body: body.slice(0, 500),
    })
    return {
      dispatched: false,
      reason: 'webhook_http_error',
      status: response.status,
      body: body.slice(0, 2000),
      detail: parsedDetail,
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

/** Extrai metadados úteis da resposta do robô contrato. */
const HTTP_URL_RE = /https?:\/\/[^\s"'<>]+/gi

const pickSigningUrlFromUnknown = (value) => {
  if (value == null) return ''
  if (typeof value === 'string') {
    const direct = value.trim()
    if (/^https?:\/\//i.test(direct) && !/\/api\//i.test(direct)) return direct
    const match = direct.match(HTTP_URL_RE)
    return match?.[0]?.trim() || ''
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = pickSigningUrlFromUnknown(item)
      if (found) return found
    }
    return ''
  }
  if (typeof value === 'object') {
    const preferredKeys = [
      'signingUrl',
      'signing_url',
      'link_assinatura',
      'linkAssinatura',
      'url_assinatura',
      'urlAssinatura',
      'public_url',
      'publicUrl',
      'link',
      'url',
      'href',
    ]
    for (const key of preferredKeys) {
      const found = pickSigningUrlFromUnknown(value[key])
      if (found) return found
    }
    for (const nested of Object.values(value)) {
      const found = pickSigningUrlFromUnknown(nested)
      if (found) return found
    }
  }
  return ''
}

export const parseContratoWebhookMeta = (dispatch) => {
  const resultados = dispatch?.response?.resultados
  const first = Array.isArray(resultados) ? resultados[0] : null
  const contratoIdRaw =
    first?.contratoId
    ?? first?.contrato_id
    ?? dispatch?.response?.contratoId
    ?? dispatch?.response?.contrato_id
  const contratoId = Number(contratoIdRaw)
  const signingUrl =
    pickSigningUrlFromUnknown(first)
    || pickSigningUrlFromUnknown(dispatch?.response)
    || pickSigningUrlFromUnknown(first?.mensagem)
  return {
    contratoId: Number.isFinite(contratoId) && contratoId > 0 ? contratoId : null,
    signingUrl: signingUrl || null,
    leadId: Number(first?.leadId) > 0 ? Number(first.leadId) : null,
    clientId: Number(first?.clientId) > 0 ? Number(first.clientId) : null,
    ok: first?.ok !== false,
    mensagem: str(first?.mensagem),
  }
}

const resolveContratoStatusWebhookUrl = () => {
  const base = str(env.ONETY_CONTRATO_WEBHOOK_URL)
  if (!base) return ''
  if (base.includes('/webhook/contrato')) {
    return base.replace(/\/webhook\/contrato\/?$/, '/webhook/contrato-status')
  }
  return ''
}

/** Consulta signatários no Onety via robô (assinatura parcial do contratante). */
export const dispatchOnetyContratoStatusCheck = async (contratoId) => {
  const url = resolveContratoStatusWebhookUrl()
  const id = Number(contratoId)
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, reason: 'invalid_contrato_id' }
  }
  if (!url) {
    return { ok: false, reason: 'webhook_url_not_configured' }
  }

  const headers = { 'Content-Type': 'application/json' }
  const secret = str(env.ONETY_CONTRATO_WEBHOOK_SECRET)
  if (secret) headers.Authorization = `Bearer ${secret}`

  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contratoId: id }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, reason: 'webhook_unreachable', error: message, url }
  }

  let body = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok || body?.ok === false) {
    return {
      ok: false,
      reason: 'webhook_http_error',
      status: response.status,
      body,
      url,
    }
  }

  return { ok: true, ...body }
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
    const detail = dispatch?.detail || parseOnetyWebhookFailureMessage(dispatch)
    if (detail) {
      return `Robô de contrato falhou: ${detail}`
    }
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
  { empresaId, checkoutSessionId, lineId, onetyLeadId } = {},
) => {
  const result = await emitOnetyContratoAfterStripePayment(adminClient, {
    empresaId,
    checkoutSessionId,
    lineId,
    onetyLeadId,
  })

  if (!result.ok) {
    if (result.reason === 'payload_unavailable') {
      throw badRequest(
        'Não foi possível montar o contrato: verifique assinatura MEI ativa, CNPJ/endereço da empresa e dados do signatário.',
      )
    }
    if (result.reason === 'payload_invalid') {
      throw badRequest(result.message || result.errors?.join(' ') || 'Dados insuficientes para gerar contrato.')
    }
    throw badRequest('Não foi possível gerar o contrato.')
  }

  if (!result.dispatch?.dispatched) {
    throw badRequest(contratoDispatchErrorMessage(result.dispatch))
  }

  const onetyOk = result.dispatch?.response?.ok
  if (onetyOk === false) {
    const firstFail = result.dispatch?.response?.resultados?.find((r) => !r?.ok)
    const fromBody = parseOnetyWebhookFailureMessage(result.dispatch)
    throw badRequest(
      firstFail?.mensagem
        ? `Onety rejeitou o contrato: ${firstFail.mensagem}`
        : fromBody
          ? `Onety rejeitou o contrato: ${fromBody}`
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
  { empresaId, checkoutSessionId, lineId, onetyLeadId } = {},
) => {
  const payload = await buildStripeContratoPayloadForEmpresa(adminClient, {
    empresaId,
    checkoutSessionId,
    lineId,
    onetyLeadId,
  })
  if (!payload) {
    if (lineId && adminClient) {
      try {
        await updateMeiSubscriptionLine(adminClient, lineId, {
          contrato_status: 'failed',
          contrato_error: 'Não foi possível montar payload do contrato',
        })
      } catch {
        // ignore
      }
    }
    return { ok: false, reason: 'payload_unavailable' }
  }

  const validationErrors = validateContratoPayload(payload)
  if (validationErrors.length) {
    const message = validationErrors.join(' ')
    if (lineId && adminClient) {
      try {
        await updateMeiSubscriptionLine(adminClient, lineId, {
          contrato_status: 'failed',
          contrato_error: message,
        })
      } catch {
        // ignore
      }
    }
    return { ok: false, reason: 'payload_invalid', errors: validationErrors, message }
  }

  console.info('[onety-contrato] payload gerado', JSON.stringify(payload))

  const dispatch = await dispatchOnetyContratoPayload(payload)
  const onetyOk = dispatch?.response?.ok !== false
    && !(dispatch?.response?.resultados || []).some((r) => r?.ok === false)

  if (lineId && adminClient) {
    try {
      await updateMeiSubscriptionLine(adminClient, lineId, {
        contrato_status: dispatch?.dispatched && onetyOk ? 'sent' : 'failed',
        contrato_sent_at: dispatch?.dispatched ? new Date().toISOString() : null,
        contrato_error: dispatch?.dispatched && onetyOk
          ? null
          : (dispatch?.error || dispatch?.response?.resultados?.find((r) => !r?.ok)?.mensagem || 'Falha ao enviar contrato'),
      })
    } catch (recordErr) {
      console.warn('[onety-contrato] falha ao gravar status na linha', recordErr)
    }
  }

  return { ok: true, payload, dispatch }
}
