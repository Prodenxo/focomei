jest.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    postForm: jest.fn(),
  },
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
}))

import { apiClient } from '@/lib/apiClient'
import {
  commentSupportTicket,
  listSupportTickets,
  mapSupportTicket,
  markSupportTicketRead,
} from '../supportService'

const api = apiClient as jest.Mocked<typeof apiClient>

describe('supportService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('normaliza lista, badge e estado concluído', () => {
    expect(mapSupportTicket({
      id: 'link-1',
      scrumhub_ticket_id: 42,
      codigo: 'FOCO-42',
      nome: 'Erro no DAS',
      status_nome: 'Concluído',
      concluido: true,
      unread_count: 3,
      updated_at: '2026-09-21T12:00:00Z',
    })).toEqual({
      id: 'link-1',
      scrumhubTicketId: 42,
      codigo: 'FOCO-42',
      nome: 'Erro no DAS',
      prioridade: null,
      statusId: null,
      statusNome: 'Concluído',
      concluido: true,
      aprovado: false,
      publicUrl: null,
      updatedAt: '2026-09-21T12:00:00Z',
      unreadCount: 3,
    })
  })

  it('lista chamados e retorna contador não lido', async () => {
    api.get.mockResolvedValue({
      tickets: [{ id: '1', scrumhub_ticket_id: 7, nome: 'Ajuda', unread_count: 1 }],
      unreadCount: 1,
    })
    const result = await listSupportTickets()
    expect(api.get).toHaveBeenCalledWith('/support/tickets')
    expect(result.tickets[0].scrumhubTicketId).toBe(7)
    expect(result.unreadCount).toBe(1)
  })

  it('envia resposta e marca a conversa como lida', async () => {
    api.post
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce({ unreadCount: 0 })

    await commentSupportTicket(7, 'Minha resposta')
    const read = await markSupportTicketRead(7)

    expect(api.post).toHaveBeenNthCalledWith(
      1,
      '/support/tickets/7/comments',
      { comentario: 'Minha resposta' },
    )
    expect(api.post).toHaveBeenNthCalledWith(2, '/support/tickets/7/read', {})
    expect(read.unreadCount).toBe(0)
  })
})
