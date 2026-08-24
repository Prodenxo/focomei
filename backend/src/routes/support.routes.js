import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middlewares/auth.js'
import {
  createScrumHubExternalTicket,
  fetchScrumHubTicketFormConfig,
} from '../services/scrumhub-support.service.js'
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

router.post('/tickets', requireAuth, upload.array('anexos', 10), async (req, res, next) => {
  try {
    const ticket = await createScrumHubExternalTicket({
      fields: req.body,
      files: req.files || [],
    })
    return sendCreated(res, ticket, 'Chamado criado com sucesso')
  } catch (error) {
    return next(error)
  }
})

export default router
