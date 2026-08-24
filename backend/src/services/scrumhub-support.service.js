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

function appendIfPresent (formData, key, value) {
  if (value === undefined || value === null) return
  const text = String(value).trim()
  if (!text) return
  formData.append(key, text)
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
  appendIfPresent(formData, 'prioridade', fields?.prioridade || 'media')

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
  return payload?.data ?? payload
}
