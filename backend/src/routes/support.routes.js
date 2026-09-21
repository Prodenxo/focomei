import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middlewares/auth.js'
import {
  createScrumHubExternalTicket,
  fetchScrumHubTicketFormConfig,
} from '../services/scrumhub-support.service.js'
import {
  commentOnOwnedSupportTicket,
  getOwnedSupportTicket,
  getUnreadSupportCount,
  importRequesterTicketsOnce,
  listSupportNotifications,
  listOwnedSupportTickets,
  markOwnedSupportTicketRead,
  resolveSupportRequester,
  saveSupportTicketLink,
  syncSupportTicketLink,
} from '../services/support-ticket-center.service.js'
import { sendCreated, sendSuccess } from '../utils/response.js'

const router = Router()

const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf', 'odt', 'ods', 'odp',
])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    const ext = String(file.originalname || '').split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error('Tipo de arquivo não permitido. Use PDF, Word, Excel, PowerPoint, TXT, CSV, RTF ou OpenDocument.'))
      return
    }
    cb(null, true)
  },
})

router.get('/ticket-form', requireAuth, async (_req, res, next) => {
  try {
    const data = await fetchScrumHubTicketFormConfig()
    return sendSuccess(res, data)
  } catch (error) {
    return next(error)
  }
})

const requesterFromRequest = (req) =>
  resolveSupportRequester(req.user?.id, req.accessContext)

const parseTicketId = (value) => {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('ID do chamado inválido.')
    error.status = 400
    throw error
  }
  return id
}

router.get('/tickets', requireAuth, async (req, res, next) => {
  try {
    const requester = await requesterFromRequest(req)
    const tickets = await listOwnedSupportTickets(requester)
    const unreadCount = await getUnreadSupportCount(requester.userId)
    return sendSuccess(res, { tickets, unreadCount })
  } catch (error) {
    return next(error)
  }
})

router.post('/tickets/import', requireAuth, async (req, res, next) => {
  try {
    const requester = await requesterFromRequest(req)
    const result = await importRequesterTicketsOnce(requester)
    return sendSuccess(res, result)
  } catch (error) {
    return next(error)
  }
})

router.get('/tickets/unread-count', requireAuth, async (req, res, next) => {
  try {
    const unreadCount = await getUnreadSupportCount(req.user?.id)
    return sendSuccess(res, { unreadCount })
  } catch (error) {
    return next(error)
  }
})

router.get('/tickets/notifications', requireAuth, async (req, res, next) => {
  try {
    const notifications = await listSupportNotifications(req.user?.id, req.query?.limit)
    return sendSuccess(res, { notifications })
  } catch (error) {
    return next(error)
  }
})

router.post('/tickets', requireAuth, upload.array('anexos', 10), async (req, res, next) => {
  try {
    const requester = await requesterFromRequest(req)
    const ticket = await createScrumHubExternalTicket({
      fields: {
        ...req.body,
        nome_solicitante: requester.name,
        email_solicitante: requester.email,
        contato_solicitante: requester.phone,
      },
      files: req.files || [],
    })
    const link = await saveSupportTicketLink(requester, ticket, 'create')
    // Primeira leitura estabelece a linha de base e não notifica comentários históricos.
    await syncSupportTicketLink(link).catch(() => null)
    return sendCreated(res, { ...ticket, linkId: link.id }, 'Chamado criado com sucesso')
  } catch (error) {
    return next(error)
  }
})

router.get('/tickets/:ticketId', requireAuth, async (req, res, next) => {
  try {
    const requester = await requesterFromRequest(req)
    const data = await getOwnedSupportTicket(requester, parseTicketId(req.params.ticketId))
    return sendSuccess(res, data)
  } catch (error) {
    return next(error)
  }
})

router.get('/tickets/:ticketId/timeline', requireAuth, async (req, res, next) => {
  try {
    const requester = await requesterFromRequest(req)
    const data = await getOwnedSupportTicket(requester, parseTicketId(req.params.ticketId))
    return sendSuccess(res, { timeline: data.timeline, ticket: data.ticket })
  } catch (error) {
    return next(error)
  }
})

router.post('/tickets/:ticketId/comments', requireAuth, async (req, res, next) => {
  try {
    const requester = await requesterFromRequest(req)
    const comment = await commentOnOwnedSupportTicket(
      requester,
      parseTicketId(req.params.ticketId),
      req.body?.comentario,
    )
    return sendCreated(res, comment, 'Resposta enviada')
  } catch (error) {
    return next(error)
  }
})

router.post('/tickets/:ticketId/read', requireAuth, async (req, res, next) => {
  try {
    const data = await markOwnedSupportTicketRead(
      req.user?.id,
      parseTicketId(req.params.ticketId),
    )
    return sendSuccess(res, data)
  } catch (error) {
    return next(error)
  }
})

export default router
