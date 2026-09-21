import { apiClient } from '@/lib/apiClient'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type SupportTicketFormConfig = {
  slug: string
  projeto: {
    nome?: string
    empresa_nome?: string
  } | null
  formulario: Record<string, unknown>
}

export type SupportTicketAttachment = {
  uri: string
  name: string
  type?: string
  size?: number | null
}

export type SupportTicketPriority = 'baixa' | 'media' | 'alta' | 'urgente'

export type CreateSupportTicketInput = {
  nome: string
  descricao?: string
  prioridade: SupportTicketPriority
  prazo: string
  nome_solicitante?: string
  email_solicitante?: string
  contato_solicitante?: string
  anexos?: SupportTicketAttachment[]
}

export type SupportTicket = {
  id: string
  scrumhubTicketId: number
  codigo?: string | null
  nome: string
  prioridade?: string | null
  statusId?: number | null
  statusNome?: string | null
  concluido: boolean
  aprovado: boolean
  publicUrl?: string | null
  updatedAt?: string | null
  unreadCount: number
}

export type SupportTimelineItem = {
  id: string
  type: string
  text: string
  createdAt?: string | null
  authorName: string
  authorEmail?: string | null
  external: boolean
}

export type SupportNotification = {
  id: string
  eventType: 'comment' | 'completed'
  title: string
  message: string
  readAt?: string | null
  createdAt: string
  scrumhubTicketId: number
  codigo?: string | null
}

export type SupportTicketDetail = {
  ticket: {
    scrumhubTicketId: number
    codigo?: string | null
    nome: string
    prioridade?: string | null
    statusId?: number | null
    statusNome?: string | null
    concluido: boolean
    aprovado: boolean
    publicUrl?: string | null
  } | null
  timeline: SupportTimelineItem[]
}

export const mapSupportTicket = (row: Record<string, unknown>): SupportTicket => ({
  id: String(row.id || ''),
  scrumhubTicketId: Number(row.scrumhub_ticket_id || row.scrumhubTicketId),
  codigo: (row.codigo as string | null) ?? null,
  nome: String(row.nome || 'Chamado'),
  prioridade: (row.prioridade as string | null) ?? null,
  statusId: Number(row.status_id || row.statusId) || null,
  statusNome: (row.status_nome as string | null) ?? (row.statusNome as string | null) ?? null,
  concluido: Boolean(row.concluido),
  aprovado: Boolean(row.aprovado),
  publicUrl: (row.public_url as string | null) ?? (row.publicUrl as string | null) ?? null,
  updatedAt: (row.last_remote_update_at as string | null)
    ?? (row.updated_at as string | null)
    ?? null,
  unreadCount: Number(row.unread_count || row.unreadCount || 0),
})

export async function fetchSupportTicketFormConfig (): Promise<SupportTicketFormConfig> {
  return apiClient.get<SupportTicketFormConfig>('/support/ticket-form')
}

async function appendAttachment (formData: FormData, file: SupportTicketAttachment) {
  const mimeType = file.type || 'application/octet-stream'
  const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined'
  if (isWeb) {
    const response = await fetch(file.uri)
    const blob = await response.blob()
    const fileBlob = new File([blob], file.name, { type: mimeType })
    formData.append('anexos', fileBlob)
    return
  }
  // @ts-expect-error React Native FormData aceita { uri, name, type }
  formData.append('anexos', { uri: file.uri, name: file.name, type: mimeType })
}

export async function createSupportTicket (input: CreateSupportTicketInput): Promise<Record<string, unknown>> {
  const formData = new FormData()
  formData.append('nome', input.nome.trim())
  if (input.descricao?.trim()) formData.append('descricao', input.descricao.trim())
  if (input.nome_solicitante?.trim()) {
    formData.append('nome_solicitante', input.nome_solicitante.trim())
  }
  if (input.email_solicitante?.trim()) {
    formData.append('email_solicitante', input.email_solicitante.trim())
  }
  if (input.contato_solicitante?.trim()) {
    formData.append('contato_solicitante', input.contato_solicitante.trim())
  }
  formData.append('prioridade', input.prioridade)
  formData.append('prazo', input.prazo.trim())

  for (const file of input.anexos || []) {
    await appendAttachment(formData, file)
  }

  const result = await apiClient.postForm<Record<string, unknown>>('/support/tickets', formData)
  const ticket = (result.ticket || result) as Record<string, unknown>
  const id = Number(ticket.id || result.id)
  const url = String(result.url || ticket.url || '')
  if (Number.isFinite(id) && id > 0) {
    await AsyncStorage.setItem(
      'support:last-ticket',
      JSON.stringify({ id, url: url || null, savedAt: new Date().toISOString() }),
    )
  }
  return result
}

export async function listSupportTickets (): Promise<{
  tickets: SupportTicket[]
  unreadCount: number
}> {
  const result = await apiClient.get<{
    tickets: Record<string, unknown>[]
    unreadCount: number
  }>('/support/tickets')
  return {
    tickets: (result.tickets || []).map(mapSupportTicket),
    unreadCount: Number(result.unreadCount || 0),
  }
}

export async function getSupportUnreadCount (): Promise<number> {
  const result = await apiClient.get<{ unreadCount: number }>('/support/tickets/unread-count')
  return Number(result.unreadCount || 0)
}

export async function listSupportNotifications (): Promise<{
  notifications: SupportNotification[]
  unreadCount: number
}> {
  const result = await apiClient.get<{
    notifications: Record<string, unknown>[]
    unreadCount: number
  }>('/support/tickets/notifications?limit=20')
  return {
    unreadCount: Number(result.unreadCount || 0),
    notifications: (result.notifications || []).map((row) => ({
      id: String(row.id),
      eventType: row.event_type === 'completed' ? 'completed' : 'comment',
      title: String(row.title || 'Atualização no chamado'),
      message: String(row.message || ''),
      readAt: (row.read_at as string | null) ?? null,
      createdAt: String(row.created_at || ''),
      scrumhubTicketId: Number(row.scrumhub_ticket_id),
      codigo: (row.codigo as string | null) ?? null,
    })),
  }
}

export async function markSupportNotificationRead (
  eventId: string,
): Promise<{ unreadCount: number }> {
  return apiClient.post(`/support/tickets/notifications/${eventId}/read`, {})
}

export async function markAllSupportNotificationsRead (): Promise<{ unreadCount: number }> {
  return apiClient.post('/support/tickets/notifications/read-all', {})
}

export async function getSupportTicketDetail (
  ticketId: number,
): Promise<SupportTicketDetail> {
  return apiClient.get<SupportTicketDetail>(`/support/tickets/${ticketId}`)
}

export async function commentSupportTicket (
  ticketId: number,
  comentario: string,
): Promise<unknown> {
  return apiClient.post(`/support/tickets/${ticketId}/comments`, { comentario })
}

export async function markSupportTicketRead (
  ticketId: number,
): Promise<{ unreadCount: number }> {
  return apiClient.post(`/support/tickets/${ticketId}/read`, {})
}
