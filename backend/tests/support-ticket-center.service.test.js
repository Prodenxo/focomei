import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertSupportTicketOwnership,
  deliverPendingSupportWhatsapp,
  isTeamComment,
  normalizeRemoteTicket,
  normalizeTimelineItem,
  syncSupportTicketLink,
} from '../src/services/support-ticket-center.service.js'

test('normaliza os envelopes usados pelo ScrumHub', () => {
  assert.deepEqual(
    normalizeRemoteTicket({
      data: {
        ticket: {
          id: 321,
          codigo: 'FOCO-321',
          nome: 'Dúvida',
          status_id: 127,
          projeto_id: 39,
          is_externo: 1,
        },
        url: 'https://scrumhub.test/t/321',
      },
    }),
    {
      scrumhubTicketId: 321,
      codigo: 'FOCO-321',
      nome: 'Dúvida',
      prioridade: null,
      statusId: 127,
      statusNome: null,
      concluido: true,
      aprovado: false,
      publicUrl: 'https://scrumhub.test/t/321',
      updatedAt: null,
      projetoId: 39,
      isExterno: true,
    },
  )
})

test('normaliza comentário externo da timeline para a conversa', () => {
  assert.deepEqual(
    normalizeTimelineItem({
      comentario_id: 9,
      comentario: 'Preciso de ajuda',
      nome_externo: 'Maria',
      email_externo: 'maria@example.com',
      criado_em: '2026-09-21T10:00:00Z',
    }),
    {
      id: '9',
      type: 'comment',
      text: 'Preciso de ajuda',
      createdAt: '2026-09-21T10:00:00Z',
      authorName: 'Maria',
      authorEmail: 'maria@example.com',
      external: true,
    },
  )
})

test('nega ownership quando o vínculo não pertence ao usuário', () => {
  assert.throws(
    () => assertSupportTicketOwnership({ user_id: 'outro-user' }, 'user-1'),
    /Chamado não encontrado/,
  )
})

const baseLink = {
  id: 'link-1',
  user_id: 'user-1',
  scrumhub_ticket_id: 321,
  requester_email: 'maria@example.com',
  requester_phone: '5511999999999',
  conhecido: [],
  concluido: false,
  last_synced_at: '2026-09-21T09:00:00Z',
  known_remote_event_keys: ['comment:1'],
}

test('sync é idempotente e só cria evento para comentário novo da equipe', async () => {
  const calls = []
  const result = await syncSupportTicketLink(baseLink, {
    fetchTicketFn: async () => ({
      id: 321,
      codigo: 'FOCO-321',
      nome: 'Dúvida',
      projeto_id: 39,
      is_externo: 1,
      concluido: 0,
    }),
    fetchTimelineFn: async () => [
      {
        id: 1,
        tipo: 'comentario',
        comentario: 'Mensagem antiga',
        usuario_id: 5,
      },
      {
        id: 2,
        tipo: 'comentario',
        comentario: 'Resposta nova',
        usuario_id: 5,
        nome_usuario: 'Atendimento',
      },
    ],
    queryFn: async (sql, params) => {
      calls.push({ sql, params })
      if (sql.includes('insert into public.support_ticket_events')) {
        return { rows: [{ id: 'event-1' }] }
      }
      return { rows: [] }
    },
  })

  assert.equal(result.createdEvents, 1)
  const insert = calls.find((call) => call.sql.includes('support_ticket_events'))
  assert.equal(insert.params[2], 'comment:2')
  assert.equal(insert.params[3], 'comment')
})

test('payload real do ScrumHub: abertura é do cliente e comentário do painel notifica', () => {
  const mensagens = [
    {
      tipo: 'abertura',
      id: null,
      texto: 'teste',
      autor: 'Leonardo de Lima',
      created_at: '2026-09-21 14:16:26',
    },
    {
      tipo: 'comentario',
      id: 3217,
      texto: 'Teste',
      autor: 'Leonardo de Lima',
      usuario_id: 25,
      nome_externo: null,
      created_at: '2026-09-21 14:17:24',
    },
    {
      tipo: 'comentario',
      id: 3218,
      texto: 'Oi',
      autor: 'Leonardo de Lima',
      usuario_id: 25,
      nome_externo: 'Leonardo de Lima',
      created_at: '2026-09-21 14:22:12',
    },
  ]

  const [abertura, doPainel, doApp] = mensagens.map(normalizeTimelineItem)

  assert.equal(abertura.text, 'teste')
  assert.equal(abertura.external, true)
  assert.equal(doPainel.type, 'comment')
  assert.equal(doPainel.text, 'Teste')
  assert.equal(doPainel.external, false)
  assert.equal(doApp.external, true)

  assert.equal(isTeamComment(mensagens[1], 'leo.irak@hotmail.com'), true)
  assert.equal(isTeamComment(mensagens[2], 'leo.irak@hotmail.com'), false)
})

test('comentário da equipe sem autor identificado ainda notifica', async () => {
  const calls = []
  const result = await syncSupportTicketLink(baseLink, {
    fetchTicketFn: async () => ({ id: 321, nome: 'Dúvida', projeto_id: 39, is_externo: 1 }),
    fetchTimelineFn: async () => [
      { id: 1, tipo: 'comentario', comentario: 'Mensagem antiga' },
      { id: 7, tipo: 'comentario', comentario: 'Já verificamos aqui' },
    ],
    queryFn: async (sql, params) => {
      calls.push({ sql, params })
      if (sql.includes('insert into public.support_ticket_events')) {
        return { rows: [{ id: 'event-7' }] }
      }
      return { rows: [] }
    },
  })

  assert.equal(result.createdEvents, 1)
  const insert = calls.find((call) => call.sql.includes('support_ticket_events'))
  assert.equal(insert.params[2], 'comment:7')
})

test('comentário do próprio solicitante não vira notificação', async () => {
  let inserted = false
  const result = await syncSupportTicketLink(baseLink, {
    fetchTicketFn: async () => ({ id: 321, nome: 'Dúvida', projeto_id: 39, is_externo: 1 }),
    fetchTimelineFn: async () => [
      { id: 1, tipo: 'comentario', comentario: 'Mensagem antiga' },
      {
        id: 8,
        tipo: 'comentario',
        comentario: 'Segue o anexo',
        nome_externo: 'Cliente',
        email_externo: 'cliente@exemplo.com',
      },
    ],
    queryFn: async (sql) => {
      if (sql.includes('insert into public.support_ticket_events')) inserted = true
      return { rows: [] }
    },
  })

  assert.equal(inserted, false)
  assert.equal(result.createdEvents, 0)
})

test('primeiro sync só estabelece baseline, sem notificar histórico', async () => {
  let inserted = false
  const result = await syncSupportTicketLink(
    { ...baseLink, last_synced_at: null, known_remote_event_keys: [] },
    {
      fetchTicketFn: async () => ({
        id: 321,
        nome: 'Dúvida',
        projeto_id: 39,
        is_externo: 1,
      }),
      fetchTimelineFn: async () => [{
        id: 10,
        tipo: 'comentario',
        comentario: 'Histórico',
        usuario_id: 5,
      }],
      queryFn: async (sql) => {
        if (sql.includes('insert into public.support_ticket_events')) inserted = true
        return { rows: [] }
      },
    },
  )
  assert.equal(result.createdEvents, 0)
  assert.equal(inserted, false)
})

test('falha de WhatsApp é registrada sem interromper a sincronização', async () => {
  const updates = []
  let firstQuery = true
  const result = await deliverPendingSupportWhatsapp(
    {},
    {
      configuredFn: () => true,
      sendFn: async () => { throw new Error('canal indisponível') },
      queryFn: async (sql, params) => {
        if (firstQuery) {
          firstQuery = false
          return {
            rows: [{
              id: 'event-1',
              title: 'Nova resposta',
              message: 'Olá',
              requester_phone: '5511999999999',
              public_url: null,
            }],
          }
        }
        updates.push({ sql, params })
        return { rows: [] }
      },
    },
  )
  assert.equal(result.sent, 0)
  assert.equal(result.processed, 1)
  assert.match(updates[0].params[1], /canal indisponível/)
})
