import { createHash } from 'node:crypto'
import { env } from '../config/env.js'
import { query } from '../config/pg.js'
import { badRequest, forbidden, notFound } from '../utils/errors.js'
import {
  createScrumHubTicketComment,
  fetchScrumHubTicket,
  fetchScrumHubTicketTimeline,
  listScrumHubProjectTickets,
  listScrumHubTicketsForRequester,
} from './scrumhub-support.service.js'
import {
  isWhatsappOutboundConfigured,
  sendWhatsappMessage,
} from './whatsapp-outbound.service.js'

const SCRUMHUB_PROJECT_ID = 39
const COMPLETED_STATUS_ID = 127
/** Nome exibido no ScrumHub quando a equipe responde pelo FocoMEI. */
export const SUPPORT_AGENT_DISPLAY_NAME = 'Equipe FocoMEI'

/**
 * O aviso leva o solicitante para a central no app, nunca para o ScrumHub:
 * a URL pública do ticket aponta para domínios internos que o cliente não acessa.
 */
export const supportCenterLink = () =>
  String(env.FRONTEND_URL || 'https://focomei.com.br').replace(/\/$/, '')
const onlyDigits = (value) => String(value || '').replace(/\D/g, '')
const text = (value) => String(value ?? '').trim()
const bool = (value) => value === true || value === 1 || value === '1'

const first = (...values) => values.find((value) => value !== undefined && value !== null && value !== '')

const ticketRecord = (payload) => payload?.ticket || payload?.data?.ticket || payload?.data || payload

export const normalizeRemoteTicket = (payload) => {
  const row = ticketRecord(payload) || {}
  const id = Number(first(row.id, row.ticket_id, row.ticketId))
  if (!Number.isFinite(id) || id <= 0) return null
  const statusId = Number(first(row.status_id, row.statusId))
  const rawProjectId = first(row.projeto_id, row.project_id)
  const rawExternal = first(row.is_externo, row.external)
  const projectId = rawProjectId === undefined ? null : Number(rawProjectId)
  return {
    scrumhubTicketId: id,
    codigo: text(first(row.codigo, row.code)) || null,
    nome: text(first(row.nome, row.name, row.titulo, row.title)) || `Chamado #${id}`,
    prioridade: text(first(row.prioridade, row.priority)) || null,
    statusId: Number.isFinite(statusId) ? statusId : null,
    statusNome: text(first(row.status_nome, row.statusName, row.status?.nome)) || null,
    concluido: bool(row.concluido) || statusId === COMPLETED_STATUS_ID,
    aprovado: bool(row.aprovado) || row.status === 'approved',
    publicUrl: text(first(row.url, payload?.url, payload?.data?.url)) || null,
    updatedAt: first(row.updated_at, row.updatedAt, row.created_at, row.createdAt) || null,
    projetoId: Number.isFinite(projectId) ? projectId : null,
    isExterno: rawExternal === undefined ? null : bool(rawExternal),
  }
}

export const assertSupportTicketOwnership = (link, userId) => {
  if (!link || String(link.user_id) !== String(userId)) {
    throw forbidden('Chamado não encontrado para este solicitante.')
  }
  return link
}

const timelineText = (row) => text(first(
  row.comentario,
  row.texto,
  row.message,
  row.mensagem,
  row.conteudo,
  row.descricao,
))

const timelineId = (row) => text(first(
  row.id,
  row.comentario_id,
  row.comment_id,
  row.event_id,
))

const timelineCreatedAt = (row) => first(
  row.created_at,
  row.criado_em,
  row.createdAt,
  row.data,
  null,
)

const timelineAuthorEmail = (row) => text(first(
  row.email,
  row.email_externo,
  row.usuario?.email,
  row.user?.email,
))

const timelineAuthorName = (row) => text(first(
  row.nome_externo,
  row.nome_usuario,
  row.usuario?.nome,
  row.user?.name,
  row.autor,
  row.author,
)) || 'Equipe FocoMEI'

const timelineImage = (row) => text(first(
  row.imagem,
  row.comentario_img,
  row.imagem_url,
  row.image,
)) || null

/** Anexos só existem na abertura do chamado; comentários carregam uma imagem única. */
const timelineAttachments = (rows) => (Array.isArray(rows) ? rows : [])
  .map((item) => {
    const url = text(first(item?.url, item?.arquivo_url, item?.path, item))
    if (!url) return null
    return {
      url,
      name: text(first(item?.nome, item?.name, item?.arquivo)) || url.split('/').pop() || 'anexo',
    }
  })
  .filter(Boolean)

const isCommentItem = (row) => {
  const kind = text(first(row.tipo, row.type, row.event_type, row.kind)).toLowerCase()
  if (kind.includes('coment') || kind.includes('comment')) return true
  return Boolean(row.comentario || row.comentario_id || row.comment_id)
}

const remoteEventKey = (row) => {
  const id = timelineId(row)
  if (id) return `comment:${id}`
  return `comment:${createHash('sha256')
    .update(JSON.stringify([
      timelineText(row),
      timelineCreatedAt(row),
      timelineAuthorEmail(row),
      timelineAuthorName(row),
    ]))
    .digest('hex')
    .slice(0, 32)}`
}

/** Comentário é da equipe por exclusão: tudo que não é do próprio solicitante notifica. */
export const isTeamComment = (row, requesterEmail, agentCommentIds) => {
  // Resposta publicada pela própria equipe no FocoMEI vai como externa no ScrumHub.
  if (asIdSet(agentCommentIds).has(timelineId(row))) return true
  const email = timelineAuthorEmail(row).toLowerCase()
  if (email && email === text(requesterEmail).toLowerCase()) return false
  if (row.nome_externo || row.email_externo) return false
  if (bool(row.is_externo) || text(row.origem).toLowerCase().includes('extern')) return false
  return true
}

/** Abertura do chamado é sempre do solicitante, mesmo sem campos de externo. */
const isAberturaItem = (row) =>
  text(first(row.tipo, row.type)).toLowerCase().includes('abertura')

/** Tolerante a `timeline.map(normalizeTimelineItem)`, que passaria o índice aqui. */
const asIdSet = (value) => (value instanceof Set ? value : new Set())

export const normalizeTimelineItem = (row, agentCommentIds) => {
  const fromAgent = asIdSet(agentCommentIds).has(timelineId(row))
  return {
    id: timelineId(row) || remoteEventKey(row),
    type: isCommentItem(row) ? 'comment' : text(first(row.tipo, row.type)) || 'event',
    text: timelineText(row),
    imageUrl: timelineImage(row),
    attachments: timelineAttachments(row.anexos),
    createdAt: timelineCreatedAt(row),
    authorName: fromAgent ? SUPPORT_AGENT_DISPLAY_NAME : timelineAuthorName(row),
    authorEmail: fromAgent ? null : (timelineAuthorEmail(row) || null),
    // `external` = lado do solicitante. Resposta da equipe nunca é do solicitante.
    external: fromAgent
      ? false
      : Boolean(row.nome_externo || row.email_externo || bool(row.is_externo) || isAberturaItem(row)),
  }
}

/**
 * Autoria das respostas da equipe é um reforço: sem ela a conversa ainda abre,
 * apenas mostrando a mensagem do lado do solicitante (como o ScrumHub devolve).
 */
const loadAgentCommentIds = async (scrumhubTicketId, queryFn = query) => {
  try {
    const { rows } = await queryFn(
      `select remote_comment_id from public.support_ticket_agent_replies
        where scrumhub_ticket_id = $1`,
      [scrumhubTicketId],
    )
    return new Set(rows.map((row) => String(row.remote_comment_id)))
  } catch (error) {
    console.warn(
      '[support-ticket] não foi possível ler as respostas da equipe',
      { ticketId: scrumhubTicketId, error: error instanceof Error ? error.message : error },
    )
    return new Set()
  }
}

export const resolveSupportRequester = async (userId, accessContext = {}) => {
  const { rows } = await query(
    `select id, email, phone, raw_user_meta_data
       from public.users
      where id = $1 and deleted_at is null
      limit 1`,
    [userId],
  )
  const user = rows[0]
  if (!user) throw forbidden('Usuário não encontrado.')
  const metadata = user.raw_user_meta_data || {}
  const email = text(user.email).toLowerCase()
  if (!email) throw badRequest('Seu perfil precisa de um e-mail para consultar chamados.')
  return {
    userId: user.id,
    empresaId: accessContext?.empresaId || null,
    email,
    phone: onlyDigits(first(user.phone, metadata.phone, metadata.telefone)) || null,
    name: text(first(metadata.full_name, metadata.name, metadata.display_name, email.split('@')[0])),
  }
}

export const saveSupportTicketLink = async (
  requester,
  remotePayload,
  importSource = 'create',
) => {
  const ticket = normalizeRemoteTicket(remotePayload)
  if (!ticket) throw badRequest('ScrumHub não retornou o ID do chamado.')
  if (ticket.projetoId !== null && ticket.projetoId !== SCRUMHUB_PROJECT_ID) {
    throw forbidden('Chamado não pertence ao projeto Foco MEI.')
  }
  if (ticket.isExterno === false) throw forbidden('Somente chamados externos podem ser vinculados.')

  const { rows } = await query(
    `insert into public.support_ticket_links (
       user_id, empresa_id, scrumhub_ticket_id, codigo, nome, prioridade,
       status_id, status_nome, concluido, aprovado, public_url,
       requester_email, requester_phone, requester_name, last_remote_update_at,
       import_source
     ) values (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       $12, $13, $14, $15, $16
     )
     on conflict (scrumhub_ticket_id) do update set
       codigo = coalesce(excluded.codigo, support_ticket_links.codigo),
       nome = excluded.nome,
       prioridade = coalesce(excluded.prioridade, support_ticket_links.prioridade),
       status_id = coalesce(excluded.status_id, support_ticket_links.status_id),
       status_nome = coalesce(excluded.status_nome, support_ticket_links.status_nome),
       concluido = excluded.concluido,
       aprovado = excluded.aprovado,
       public_url = coalesce(excluded.public_url, support_ticket_links.public_url),
       last_remote_update_at = coalesce(excluded.last_remote_update_at, support_ticket_links.last_remote_update_at)
     where support_ticket_links.user_id = excluded.user_id
     returning *`,
    [
      requester.userId,
      requester.empresaId,
      ticket.scrumhubTicketId,
      ticket.codigo,
      ticket.nome,
      ticket.prioridade,
      ticket.statusId,
      ticket.statusNome,
      ticket.concluido,
      ticket.aprovado,
      ticket.publicUrl,
      requester.email,
      requester.phone,
      requester.name,
      ticket.updatedAt,
      importSource,
    ],
  )
  const link = rows[0]
  if (!link) {
    throw forbidden('Este chamado já pertence a outro solicitante.')
  }
  return assertSupportTicketOwnership(link, requester.userId)
}

const getOwnedLink = async (userId, scrumhubTicketId) => {
  const { rows } = await query(
    `select * from public.support_ticket_links
      where user_id = $1 and scrumhub_ticket_id = $2
      limit 1`,
    [userId, scrumhubTicketId],
  )
  if (!rows[0]) throw notFound('Chamado não encontrado.')
  return assertSupportTicketOwnership(rows[0], userId)
}

export const importRequesterTicketsOnce = async (requester) => {
  const state = await query(
    'select imported_at from public.support_ticket_import_state where user_id = $1',
    [requester.userId],
  )
  if (state.rows[0]) return { imported: 0, alreadyImported: true }

  const remoteTickets = await listScrumHubTicketsForRequester({
    email: requester.email,
    phone: requester.phone,
  })
  let imported = 0
  for (const summary of remoteTickets) {
    const normalized = normalizeRemoteTicket(summary)
    if (!normalized) continue
    const detail = await fetchScrumHubTicket(normalized.scrumhubTicketId)
    const detailNormalized = normalizeRemoteTicket(detail)
    if (
      !detailNormalized
      || detailNormalized.projetoId !== SCRUMHUB_PROJECT_ID
      || !detailNormalized.isExterno
    ) continue
    await saveSupportTicketLink(requester, { ...summary, ...detail }, 'legacy_import')
    imported += 1
  }
  await query(
    `insert into public.support_ticket_import_state (user_id, imported_at)
     values ($1, now())
     on conflict (user_id) do update set imported_at = excluded.imported_at`,
    [requester.userId],
  )
  return { imported, alreadyImported: false }
}

export const listOwnedSupportTickets = async (requester) => {
  await importRequesterTicketsOnce(requester)
  const { rows } = await query(
    `select l.id, l.scrumhub_ticket_id, l.codigo, l.nome, l.prioridade,
            l.status_id, l.status_nome, l.concluido, l.aprovado, l.public_url,
            l.last_remote_update_at, l.updated_at,
            count(e.id) filter (where e.read_at is null)::integer as unread_count
       from public.support_ticket_links l
       left join public.support_ticket_events e on e.ticket_link_id = l.id
      where l.user_id = $1
      group by l.id
      order by coalesce(l.last_remote_update_at, l.updated_at) desc`,
    [requester.userId],
  )
  return rows
}

export const getOwnedSupportTicket = async (requester, ticketId) => {
  const link = await getOwnedLink(requester.userId, ticketId)
  const [remote, timeline, agentCommentIds] = await Promise.all([
    fetchScrumHubTicket(ticketId),
    fetchScrumHubTicketTimeline(ticketId),
    loadAgentCommentIds(ticketId),
  ])
  return {
    link,
    ticket: normalizeRemoteTicket(remote),
    timeline: timeline.map((row) => normalizeTimelineItem(row, agentCommentIds)),
  }
}

/** Mensagem vazia só é aceita quando existe imagem: print sozinho já comunica. */
const assertCommentPayload = (comment, imagem) => {
  const message = text(comment)
  if (!message && !text(imagem)) {
    throw badRequest('Escreva uma mensagem ou anexe uma imagem.')
  }
  if (message.length > 5000) throw badRequest('A resposta deve ter no máximo 5000 caracteres.')
  return message
}

export const commentOnOwnedSupportTicket = async (requester, ticketId, comment, imagem = null) => {
  const message = assertCommentPayload(comment, imagem)
  await getOwnedLink(requester.userId, ticketId)
  return createScrumHubTicketComment(ticketId, {
    comentario: message || '(imagem)',
    nomeExterno: requester.name,
    email: requester.email,
    phone: requester.phone,
    imagem,
  })
}

const getLinkByTicketId = async (scrumhubTicketId) => {
  const { rows } = await query(
    'select * from public.support_ticket_links where scrumhub_ticket_id = $1 limit 1',
    [scrumhubTicketId],
  )
  return rows[0] || null
}

/** Superadmin enxerga todo o projeto 39, inclusive chamados abertos fora do FocoMEI. */
export const listSupportTicketsForAdmin = async () => {
  const remoteTickets = await listScrumHubProjectTickets(SCRUMHUB_PROJECT_ID)
  const { rows: links } = await query(
    `select l.scrumhub_ticket_id, l.user_id, l.requester_name, l.requester_email,
            count(e.id) filter (where e.read_at is null)::integer as owner_unread_count
       from public.support_ticket_links l
       left join public.support_ticket_events e on e.ticket_link_id = l.id
      group by l.id`,
  )
  const linkByTicket = new Map(links.map((row) => [Number(row.scrumhub_ticket_id), row]))

  return remoteTickets
    .map((row) => {
      const ticket = normalizeRemoteTicket(row)
      if (!ticket) return null
      const link = linkByTicket.get(ticket.scrumhubTicketId) || null
      return {
        ...ticket,
        solicitanteNome: text(first(row.nome_solicitante, link?.requester_name)) || null,
        solicitanteEmail: text(first(row.email_solicitante, link?.requester_email)) || null,
        vinculadoAoApp: Boolean(link),
        ownerUnreadCount: link?.owner_unread_count || 0,
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
}

export const getSupportTicketForAdmin = async (ticketId) => {
  const [remote, timeline, agentCommentIds, link] = await Promise.all([
    fetchScrumHubTicket(ticketId),
    fetchScrumHubTicketTimeline(ticketId),
    loadAgentCommentIds(ticketId),
    getLinkByTicketId(ticketId),
  ])
  const ticket = normalizeRemoteTicket(remote)
  if (!ticket) throw notFound('Chamado não encontrado.')
  if (ticket.projetoId !== null && ticket.projetoId !== SCRUMHUB_PROJECT_ID) {
    throw forbidden('Chamado não pertence ao projeto Foco MEI.')
  }
  return {
    ticket,
    // Para a equipe, os lados se invertem: a resposta da equipe é que fica à direita.
    timeline: timeline.map((row) => normalizeTimelineItem(row, agentCommentIds)),
    solicitante: {
      nome: text(first(remote?.nome_solicitante, link?.requester_name)) || null,
      email: text(first(remote?.email_solicitante, link?.requester_email)) || null,
      telefone: onlyDigits(first(remote?.contato_solicitante, link?.requester_phone)) || null,
    },
    vinculadoAoApp: Boolean(link),
  }
}

/**
 * Publica a resposta da equipe e avisa o solicitante (badge + WhatsApp).
 * A API pública só cria comentário externo, então o autor real fica no banco local.
 */
export const replySupportTicketAsAgent = async (agent, ticketId, comment, imagem = null) => {
  const message = assertCommentPayload(comment, imagem)
  const remoteTicket = normalizeRemoteTicket(await fetchScrumHubTicket(ticketId))
  if (!remoteTicket) throw notFound('Chamado não encontrado.')
  if (remoteTicket.projetoId !== null && remoteTicket.projetoId !== SCRUMHUB_PROJECT_ID) {
    throw forbidden('Chamado não pertence ao projeto Foco MEI.')
  }

  const created = await createScrumHubTicketComment(ticketId, {
    comentario: message || '(imagem)',
    nomeExterno: SUPPORT_AGENT_DISPLAY_NAME,
    imagem,
  })

  // O comentário já foi publicado: falha no registro local não invalida o envio.
  const remoteCommentId = text(first(created?.id, created?.comentario_id))
  if (remoteCommentId) {
    await query(
      `insert into public.support_ticket_agent_replies (
         scrumhub_ticket_id, remote_comment_id, agent_user_id, agent_name
       ) values ($1, $2, $3, $4)
       on conflict (scrumhub_ticket_id, remote_comment_id) do nothing`,
      [ticketId, remoteCommentId, agent.userId || null, agent.name || SUPPORT_AGENT_DISPLAY_NAME],
    ).catch((error) => {
      console.warn(
        '[support-ticket] resposta enviada, mas a autoria da equipe não foi registrada',
        { ticketId, error: error instanceof Error ? error.message : error },
      )
    })
  }

  const link = await getLinkByTicketId(ticketId)
  if (link) {
    await insertSupportEvent(link, {
      key: remoteCommentId ? `comment:${remoteCommentId}` : `comment:agent:${Date.now()}`,
      type: 'comment',
      title: `Nova resposta no chamado ${link.codigo || `#${ticketId}`}`,
      message: (message || 'A equipe enviou uma imagem.').slice(0, 500),
      remoteCommentId: remoteCommentId || null,
      remoteCreatedAt: new Date().toISOString(),
    })
  }

  return { comment: created, notified: Boolean(link) }
}

export const getUnreadSupportCount = async (userId) => {
  const { rows } = await query(
    `select count(*)::integer as unread_count
       from public.support_ticket_events
      where user_id = $1 and read_at is null`,
    [userId],
  )
  return rows[0]?.unread_count || 0
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const markSupportNotificationRead = async (userId, eventId) => {
  if (!UUID_RE.test(String(eventId || ''))) {
    throw badRequest('Notificação inválida.')
  }
  await query(
    `update public.support_ticket_events
        set read_at = coalesce(read_at, now())
      where id = $1 and user_id = $2`,
    [eventId, userId],
  )
  return { unreadCount: await getUnreadSupportCount(userId) }
}

export const markAllSupportNotificationsRead = async (userId) => {
  await query(
    `update public.support_ticket_events
        set read_at = now()
      where user_id = $1 and read_at is null`,
    [userId],
  )
  return { unreadCount: 0 }
}

export const listSupportNotifications = async (userId, limit = 20) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100)
  const { rows } = await query(
    `select e.id, e.event_type, e.title, e.message, e.read_at, e.created_at,
            l.scrumhub_ticket_id, l.codigo
       from public.support_ticket_events e
       join public.support_ticket_links l on l.id = e.ticket_link_id
      where e.user_id = $1
      order by e.created_at desc
      limit $2`,
    [userId, safeLimit],
  )
  return rows
}

export const markOwnedSupportTicketRead = async (userId, ticketId) => {
  const link = await getOwnedLink(userId, ticketId)
  await query(
    `update public.support_ticket_events
        set read_at = coalesce(read_at, now())
      where ticket_link_id = $1 and user_id = $2 and read_at is null`,
    [link.id, userId],
  )
  return { unreadCount: await getUnreadSupportCount(userId) }
}

const insertSupportEvent = async (link, event, queryFn = query) => {
  const { rows } = await queryFn(
    `insert into public.support_ticket_events (
       ticket_link_id, user_id, event_key, event_type, title, message,
       remote_comment_id, remote_created_at
     ) values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (ticket_link_id, event_key) do nothing
     returning id`,
    [
      link.id,
      link.user_id,
      event.key,
      event.type,
      event.title,
      event.message,
      event.remoteCommentId,
      event.remoteCreatedAt,
    ],
  )
  return Boolean(rows[0]?.id)
}

export const syncSupportTicketLink = async (link, dependencies = {}) => {
  const queryFn = dependencies.queryFn || query
  const fetchTicketFn = dependencies.fetchTicketFn || fetchScrumHubTicket
  const fetchTimelineFn = dependencies.fetchTimelineFn || fetchScrumHubTicketTimeline
  const [remotePayload, timeline, agentCommentIds] = await Promise.all([
    fetchTicketFn(link.scrumhub_ticket_id),
    fetchTimelineFn(link.scrumhub_ticket_id),
    loadAgentCommentIds(link.scrumhub_ticket_id, queryFn).catch(() => new Set()),
  ])
  const remote = normalizeRemoteTicket(remotePayload)
  if (!remote) throw badRequest('Resposta inválida do chamado no ScrumHub.')

  const comments = timeline.filter(isCommentItem)
  const currentKeys = comments.map(remoteEventKey)
  const knownKeys = new Set(Array.isArray(link.known_remote_event_keys)
    ? link.known_remote_event_keys
    : [])
  let createdEvents = 0

  if (link.last_synced_at) {
    for (const row of comments) {
      const key = remoteEventKey(row)
      if (knownKeys.has(key) || !isTeamComment(row, link.requester_email, agentCommentIds)) continue
      const created = await insertSupportEvent(link, {
        key,
        type: 'comment',
        title: `Nova resposta no chamado ${remote.codigo || `#${remote.scrumhubTicketId}`}`,
        message: timelineText(row).slice(0, 500) || 'A equipe respondeu ao seu chamado.',
        remoteCommentId: timelineId(row) || null,
        remoteCreatedAt: timelineCreatedAt(row),
      }, queryFn)
      if (created) createdEvents += 1
    }
  }

  if (remote.concluido && !link.concluido) {
    const created = await insertSupportEvent(link, {
      key: 'completed',
      type: 'completed',
      title: `Chamado ${remote.codigo || `#${remote.scrumhubTicketId}`} concluído`,
      message: 'Seu chamado foi concluído pela equipe FocoMEI.',
      remoteCommentId: null,
      remoteCreatedAt: new Date().toISOString(),
    }, queryFn)
    if (created) createdEvents += 1
  }

  const fingerprint = createHash('sha256')
    .update(JSON.stringify(currentKeys))
    .digest('hex')
  await queryFn(
    `update public.support_ticket_links set
       codigo = coalesce($2, codigo),
       nome = $3,
       prioridade = coalesce($4, prioridade),
       status_id = $5,
       status_nome = $6,
       concluido = $7,
       aprovado = $8,
       public_url = coalesce($9, public_url),
       last_remote_update_at = coalesce($10, last_remote_update_at),
       last_timeline_fingerprint = $11,
       known_remote_event_keys = $12::jsonb,
       last_synced_at = now()
     where id = $1`,
    [
      link.id,
      remote.codigo,
      remote.nome,
      remote.prioridade,
      remote.statusId,
      remote.statusNome,
      remote.concluido,
      remote.aprovado,
      remote.publicUrl,
      remote.updatedAt,
      fingerprint,
      JSON.stringify(currentKeys),
    ],
  )
  return { createdEvents, completed: remote.concluido }
}

export const syncOpenSupportTickets = async ({ limit = 100 } = {}) => {
  const { rows } = await query(
    // Concluídos recentes continuam no ciclo: a equipe ainda comenta depois de fechar.
    `select * from public.support_ticket_links
      where concluido = false
         or updated_at > now() - interval '14 days'
      order by last_synced_at nulls first, updated_at asc
      limit $1`,
    [limit],
  )
  const result = { processed: 0, events: 0, errors: [] }
  for (const link of rows) {
    try {
      const synced = await syncSupportTicketLink(link)
      result.processed += 1
      result.events += synced.createdEvents
    } catch (error) {
      result.errors.push({
        ticketId: link.scrumhub_ticket_id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return result
}

export const deliverPendingSupportWhatsapp = async (
  { limit = 50 } = {},
  dependencies = {},
) => {
  const queryFn = dependencies.queryFn || query
  const configuredFn = dependencies.configuredFn || isWhatsappOutboundConfigured
  const sendFn = dependencies.sendFn || sendWhatsappMessage
  if (!configuredFn()) return { sent: 0, skipped: true }
  const { rows } = await queryFn(
    `select e.*, l.requester_phone, l.public_url, l.codigo
       from public.support_ticket_events e
       join public.support_ticket_links l on l.id = e.ticket_link_id
      where e.whatsapp_sent_at is null and e.whatsapp_attempts < 3
      order by e.created_at asc
      limit $1`,
    [limit],
  )
  let sent = 0
  for (const event of rows) {
    if (!onlyDigits(event.requester_phone)) {
      await queryFn(
        `update public.support_ticket_events
            set whatsapp_attempts = 3, whatsapp_error = 'Telefone não cadastrado'
          where id = $1`,
        [event.id],
      )
      continue
    }
    const message = [
      event.title,
      '',
      event.message,
      '',
      `Responda em ${supportCenterLink()} — Configurações › Meus chamados.`,
    ].filter(Boolean).join('\n')
    try {
      await sendFn({ phone: event.requester_phone, message })
      await queryFn(
        `update public.support_ticket_events
            set whatsapp_sent_at = now(), whatsapp_attempts = whatsapp_attempts + 1,
                whatsapp_error = null
          where id = $1`,
        [event.id],
      )
      sent += 1
    } catch (error) {
      await queryFn(
        `update public.support_ticket_events
            set whatsapp_attempts = whatsapp_attempts + 1, whatsapp_error = $2
          where id = $1`,
        [event.id, (error instanceof Error ? error.message : String(error)).slice(0, 500)],
      )
    }
  }
  return { sent, processed: rows.length }
}
