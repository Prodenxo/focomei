import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middlewares/auth.js'
import { requireSuperAdmin } from '../middlewares/requireSuperAdmin.js'
import {
  createScrumHubExternalTicket,
  fetchScrumHubTicketFormConfig,
} from '../services/scrumhub-support.service.js'
import {
  commentOnOwnedSupportTicket,
  getOwnedSupportTicket,
  getSupportTicketForAdmin,
  getUnreadSupportCount,
  importRequesterTicketsOnce,
  listSupportNotifications,
  listOwnedSupportTickets,
  listSupportTicketsForAdmin,
  markAllSupportNotificationsRead,
  markOwnedSupportTicketRead,
  markSupportNotificationRead,
  replySupportTicketAsAgent,
  resolveSupportRequester,
  saveSupportTicketLink,
  syncSupportTicketLink,
} from '../services/support-ticket-center.service.js'
import { sendCreated, sendSuccess } from '../utils/response.js'

const router = Router()

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'heif'])

const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf', 'odt', 'ods', 'odp',
  ...IMAGE_EXTENSIONS,
])

const fileExtension = (file) =>
  String(file?.originalname || '').split('.').pop()?.toLowerCase() || ''

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_EXTENSIONS.has(fileExtension(file))) {
      cb(new Error('Tipo de arquivo não permitido. Use imagens, PDF, Word, Excel, PowerPoint, TXT, CSV, RTF ou OpenDocument.'))
      return
    }
    cb(null, true)
  },
})

/** O ScrumHub guarda a imagem do comentário como texto, então enviamos data URL. */
const MAX_COMMENT_IMAGE_BYTES = 3 * 1024 * 1024

const uploadCommentImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_COMMENT_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_EXTENSIONS.has(fileExtension(file))) {
      cb(new Error('Anexe uma imagem PNG, JPG, WEBP ou GIF.'))
      return
    }
    cb(null, true)
  },
})

const resolveCommentImage = (req) => {
  const file = req.file
  if (file?.buffer?.length) {
    const mime = file.mimetype || 'image/png'
    return `data:${mime};base64,${file.buffer.toString('base64')}`
  }
  const inline = String(req.body?.imagem || '').trim()
  if (!inline) return null
  if (!/^data:image\/[a-z.+-]+;base64,/i.test(inline) && !/^https?:\/\//i.test(inline)) {
    const error = new Error('Imagem inválida.')
    error.status = 400
    throw error
  }
  return inline
}

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
    const unreadCount = await getUnreadSupportCount(req.user?.id)
    return sendSuccess(res, { notifications, unreadCount })
  } catch (error) {
    return next(error)
  }
})

router.post('/tickets/notifications/read-all', requireAuth, async (req, res, next) => {
  try {
    return sendSuccess(res, await markAllSupportNotificationsRead(req.user?.id))
  } catch (error) {
    return next(error)
  }
})

router.post('/tickets/notifications/:eventId/read', requireAuth, async (req, res, next) => {
  try {
    const data = await markSupportNotificationRead(req.user?.id, req.params.eventId)
    return sendSuccess(res, data)
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

router.post(
  '/tickets/:ticketId/comments',
  requireAuth,
  uploadCommentImage.single('imagem'),
  async (req, res, next) => {
    try {
      const requester = await requesterFromRequest(req)
      const comment = await commentOnOwnedSupportTicket(
        requester,
        parseTicketId(req.params.ticketId),
        req.body?.comentario,
        resolveCommentImage(req),
      )
      return sendCreated(res, comment, 'Resposta enviada')
    } catch (error) {
      return next(error)
    }
  },
)

router.get('/admin/tickets', requireAuth, requireSuperAdmin, async (_req, res, next) => {
  try {
    return sendSuccess(res, { tickets: await listSupportTicketsForAdmin() })
  } catch (error) {
    return next(error)
  }
})

router.get('/admin/tickets/:ticketId', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const data = await getSupportTicketForAdmin(parseTicketId(req.params.ticketId))
    return sendSuccess(res, data)
  } catch (error) {
    return next(error)
  }
})

router.post(
  '/admin/tickets/:ticketId/comments',
  requireAuth,
  requireSuperAdmin,
  uploadCommentImage.single('imagem'),
  async (req, res, next) => {
    try {
      const agent = await requesterFromRequest(req)
      const result = await replySupportTicketAsAgent(
        agent,
        parseTicketId(req.params.ticketId),
        req.body?.comentario,
        resolveCommentImage(req),
      )
      return sendCreated(res, result, 'Resposta enviada ao solicitante')
    } catch (error) {
      return next(error)
    }
  },
)

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
