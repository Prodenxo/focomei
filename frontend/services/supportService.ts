import { apiClient } from '@/lib/apiClient'

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

export type SupportTicketPriority = 'baixa' | 'media' | 'alta' | 'critica'

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

export async function createSupportTicket (input: CreateSupportTicketInput): Promise<unknown> {
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

  return apiClient.postForm('/support/tickets', formData)
}
