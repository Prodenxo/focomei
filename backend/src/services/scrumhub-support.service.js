import { env } from '../config/env.js'
import { badRequest } from '../utils/errors.js'

const DEFAULT_SCRUMHUB_API_BASE =
  'https://scrumhub-scrumhub-backend.sf83tr.easypanel.host'
const DEFAULT_SCRUMHUB_PUBLIC_ORIGIN = 'https://scrumhub.com.br'

let cachedApiKey = null
let cachedApiKeyAt = 0
const API_KEY_CACHE_MS = 5 * 60 * 1000

function getScrumHubApiBase () {
  return (env.SCRUMHUB_API_BASE_URL || DEFAULT_SCRUMHUB_API_BASE).replace(/\/$/, '')
}

function getScrumHubPublicOrigin () {
  return (env.SCRUMHUB_PUBLIC_ORIGIN || DEFAULT_SCRUMHUB_PUBLIC_ORIGIN).replace(/\/$/, '')
}

function getScrumHubSlug () {
  return (env.SCRUMHUB_TICKET_SLUG || 'foco-mei').trim()
}

async function parseJsonResponse (response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw badRequest(payload?.error || payload?.message || fallbackMessage)
  }
  return payload
}

function apiKeyHeaders (apiKey, json = false) {
  return {
    'X-API-Key': apiKey,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  }
}

function unwrapData (payload) {
  return payload?.data ?? payload
}

export async function resolveScrumHubApiKey () {
  const fromEnv = (env.SCRUMHUB_API_KEY || '').trim()
  if (fromEnv) return fromEnv

  const now = Date.now()
  if (cachedApiKey && now - cachedApiKeyAt < API_KEY_CACHE_MS) {
    return cachedApiKey
  }

  const slug = getScrumHubSlug()
  const response = await fetch(
    `${getScrumHubPublicOrigin()}/public/formulario-config/slug/${encodeURIComponent(slug)}`,
    { method: 'GET' },
  )
  const payload = await parseJsonResponse(response, 'Não foi possível carregar o suporte ScrumHub.')
  const apiKey = String(payload?.data?.api_key || '').trim()
  if (!apiKey) {
    throw badRequest('ScrumHub não retornou API Key para o formulário de suporte.')
  }

  cachedApiKey = apiKey
  cachedApiKeyAt = now
  return apiKey
}

export async function fetchScrumHubTicketFormConfig () {
  const slug = getScrumHubSlug()
  const response = await fetch(
    `${getScrumHubPublicOrigin()}/public/formulario-config/slug/${encodeURIComponent(slug)}`,
    { method: 'GET' },
  )
  const payload = await parseJsonResponse(response, 'Não foi possível carregar o formulário de suporte.')
  const data = payload?.data || {}

  return {
    slug,
    projeto: data.projeto || null,
    formulario: data.formulario || {},
  }
}

const ALLOWED_PRIORITIES = new Set(['baixa', 'media', 'alta', 'urgente'])
/** Versões antigas do app enviavam "critica", que o ScrumHub recusa. */
const PRIORITY_ALIASES = { critica: 'urgente' }

function appendIfPresent (formData, key, value) {
  if (value === undefined || value === null) return
  const text = String(value).trim()
  if (!text) return
  formData.append(key, text)
}

function normalizePrioridade (value) {
  const raw = String(value || 'media')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const prioridade = PRIORITY_ALIASES[raw] || raw
  if (!ALLOWED_PRIORITIES.has(prioridade)) {
    throw badRequest('Prioridade deve ser: baixa, media, alta ou urgente.')
  }
  return prioridade
}

function normalizePrazo (value) {
  const prazo = String(value || '').trim()
  if (!prazo) throw badRequest('Informe o prazo do chamado.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo)) {
    throw badRequest('Prazo inválido. Use o formato AAAA-MM-DD.')
  }
  return prazo
}

export async function createScrumHubExternalTicket ({ fields, files = [] }) {
  const nome = String(fields?.nome || '').trim()
  if (!nome) throw badRequest('Informe o assunto do chamado.')

  const apiKey = await resolveScrumHubApiKey()
  const formData = new FormData()

  formData.append('nome', nome)
  appendIfPresent(formData, 'descricao', fields?.descricao)
  appendIfPresent(formData, 'nome_solicitante', fields?.nome_solicitante)
  appendIfPresent(formData, 'email_solicitante', fields?.email_solicitante)
  appendIfPresent(formData, 'contato_solicitante', fields?.contato_solicitante)
  formData.append('prioridade', normalizePrioridade(fields?.prioridade))
  formData.append('prazo', normalizePrazo(fields?.prazo))

  for (const file of files) {
    if (!file?.buffer?.length) continue
    const blob = new Blob([file.buffer], {
      type: file.mimetype || 'application/octet-stream',
    })
    formData.append('anexos', blob, file.originalname || 'anexo')
  }

  const response = await fetch(`${getScrumHubApiBase()}/public/tickets`, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
    body: formData,
  })

  const payload = await parseJsonResponse(response, 'Erro ao criar ticket no ScrumHub.')
  return unwrapData(payload)
}

async function scrumHubGet (path, fallbackMessage) {
  const apiKey = await resolveScrumHubApiKey()
  const response = await fetch(`${getScrumHubApiBase()}${path}`, {
    method: 'GET',
    headers: apiKeyHeaders(apiKey),
  })
  const payload = await parseJsonResponse(response, fallbackMessage)
  return unwrapData(payload)
}

export async function listScrumHubTicketsForRequester ({ email, phone }) {
  const params = new URLSearchParams()
  if (email) params.set('email', String(email).trim())
  if (phone) params.set('telefone', String(phone).replace(/\D/g, ''))
  if (![...params.keys()].length) {
    throw badRequest('E-mail ou telefone do solicitante não encontrado.')
  }
  const data = await scrumHubGet(
    `/public/tickets/meus?${params.toString()}`,
    'Não foi possível consultar seus chamados no ScrumHub.',
  )
  return Array.isArray(data) ? data : (data?.tickets || [])
}

export async function fetchScrumHubTicket (ticketId) {
  return scrumHubGet(
    `/tickets-pai/${encodeURIComponent(ticketId)}`,
    'Não foi possível consultar o chamado no ScrumHub.',
  )
}

export async function fetchScrumHubTicketTimeline (ticketId) {
  const data = await scrumHubGet(
    `/public/tickets/${encodeURIComponent(ticketId)}/timeline?format=flat`,
    'Não foi possível consultar a conversa do chamado.',
  )
  if (Array.isArray(data)) return data
  return data?.timeline || data?.items || data?.comentarios || []
}

export async function createScrumHubTicketComment (
  ticketId,
  { comentario, nomeExterno, email, phone },
) {
  const apiKey = await resolveScrumHubApiKey()
  const response = await fetch(
    `${getScrumHubApiBase()}/public/tickets/${encodeURIComponent(ticketId)}/comentarios`,
    {
      method: 'POST',
      headers: apiKeyHeaders(apiKey, true),
      body: JSON.stringify({
        comentario: String(comentario || '').trim(),
        nome_externo: String(nomeExterno || '').trim(),
        email: String(email || '').trim() || undefined,
        contato_solicitante: String(phone || '').replace(/\D/g, '') || undefined,
        comentario_pai_id: null,
      }),
    },
  )
  const payload = await parseJsonResponse(response, 'Não foi possível responder ao chamado.')
  return unwrapData(payload)
}
