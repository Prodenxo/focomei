const SCRUMHUB_TICKET_URL =
  'https://scrumhub.com.br/ticket-externo?slug=foco-mei'

export function getScrumHubTicketBaseUrl (): string {
  return SCRUMHUB_TICKET_URL
}

export function buildScrumHubTicketUrl (params?: {
  email?: string | null
  name?: string | null
}): string {
  const base = getScrumHubTicketBaseUrl()
  try {
    const url = new URL(base)
    const email = params?.email?.trim()
    const name = params?.name?.trim()
    if (email) url.searchParams.set('email', email)
    if (name) url.searchParams.set('nome', name)
    return url.toString()
  } catch {
    return base
  }
}
