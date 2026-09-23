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
  listAdminSupportTickets,
  listSupportNotifications,
  listSupportTickets,
  mapSupportTicket,
  markAllSupportNotificationsRead,
  markSupportNotificationRead,
  markSupportTicketRead,
  replyAdminSupportTicket,
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

  it('superadmin lista todos os chamados com o solicitante', async () => {
    api.get.mockResolvedValue({
      tickets: [{
        scrumhubTicketId: 7741,
        codigo: 'SCRUM-011',
        nome: 'teste',
        concluido: true,
        updatedAt: '2026-09-21T14:47:08Z',
        solicitanteNome: 'Leonardo de Lima',
        solicitanteEmail: 'leo.irak@hotmail.com',
        vinculadoAoApp: true,
        ownerUnreadCount: 2,
      }],
    })

    const tickets = await listAdminSupportTickets()

    expect(api.get).toHaveBeenCalledWith('/support/admin/tickets')
    expect(tickets[0]).toMatchObject({
      scrumhubTicketId: 7741,
      codigo: 'SCRUM-011',
      updatedAt: '2026-09-21T14:47:08Z',
      solicitanteNome: 'Leonardo de Lima',
      vinculadoAoApp: true,
      ownerUnreadCount: 2,
    })
  })

  it('resposta da equipe sem imagem vai como JSON na rota de admin', async () => {
    api.post.mockResolvedValue({ notified: true })

    await replyAdminSupportTicket(7741, 'Resolvido por aqui.')

    expect(api.post).toHaveBeenCalledWith(
      '/support/admin/tickets/7741/comments',
      { comentario: 'Resolvido por aqui.' },
    )
    expect(api.postForm).not.toHaveBeenCalled()
  })

  it('lista notificações do sino com contador', async () => {
    api.get.mockResolvedValue({
      unreadCount: 2,
      notifications: [{
        id: 'evt-1',
        event_type: 'comment',
        title: 'Nova resposta da equipe',
        message: 'Já verificamos aqui',
        read_at: null,
        created_at: '2026-09-21T12:00:00Z',
        scrumhub_ticket_id: 7,
        codigo: 'FOCO-7',
      }],
    })

    const result = await listSupportNotifications()

    expect(api.get).toHaveBeenCalledWith('/support/tickets/notifications?limit=20')
    expect(result.unreadCount).toBe(2)
    expect(result.notifications[0]).toEqual({
      id: 'evt-1',
      eventType: 'comment',
      title: 'Nova resposta da equipe',
      message: 'Já verificamos aqui',
      readAt: null,
      createdAt: '2026-09-21T12:00:00Z',
      scrumhubTicketId: 7,
      codigo: 'FOCO-7',
    })
  })

  it('marca notificação individual e todas como lidas', async () => {
    api.post
      .mockResolvedValueOnce({ unreadCount: 1 })
      .mockResolvedValueOnce({ unreadCount: 0 })

    expect(await markSupportNotificationRead('evt-1')).toEqual({ unreadCount: 1 })
    expect(await markAllSupportNotificationsRead()).toEqual({ unreadCount: 0 })

    expect(api.post).toHaveBeenNthCalledWith(
      1,
      '/support/tickets/notifications/evt-1/read',
      {},
    )
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      '/support/tickets/notifications/read-all',
      {},
    )
  })
})
