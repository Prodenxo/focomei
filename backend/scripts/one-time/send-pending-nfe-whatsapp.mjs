/**
 * Força envio do PDF da NF-e mais recente no WhatsApp (Z-API).
 * Uso (na pasta backend):
 *   node scripts/one-time/send-pending-nfe-whatsapp.mjs
 *   node scripts/one-time/send-pending-nfe-whatsapp.mjs <notaUuid>
 */
import 'dotenv/config'
import pg from 'pg'
import { baixarPdf } from '../../src/services/mei-notas.service.js'
import { sendWhatsappMessage } from '../../src/services/whatsapp-outbound.service.js'

const USER_ID = '7428ffe0-773d-4273-b9c9-73b9e5632f14'
const PHONE = '5521996185328'
const notaArg = String(process.argv[2] || '').trim()

const main = async () => {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
  })
  await client.connect()

  const q = notaArg
    ? {
      text: `SELECT id, status, document_type, plugnotas_id, id_integracao, metadata_json, created_at
             FROM mei_nfse WHERE id = $1 LIMIT 1`,
      values: [notaArg],
    }
    : {
      text: `SELECT id, status, document_type, plugnotas_id, id_integracao, metadata_json, created_at
             FROM mei_nfse
             WHERE user_id = $1 AND document_type = 'NFE'
             ORDER BY created_at DESC
             LIMIT 1`,
      values: [USER_ID],
    }

  const { rows } = await client.query(q.text, q.values)
  const row = rows[0]
  if (!row) {
    console.error('Nota NFE não encontrada')
    process.exit(1)
  }

  console.log('Nota encontrada:', {
    id: row.id,
    status: row.status,
    document_type: row.document_type,
    plugnotas_id: row.plugnotas_id,
    id_integracao: row.id_integracao,
    pending: row.metadata_json?.openclawWhatsappPdfPending,
    sentAt: row.metadata_json?.openclawWhatsappPdfSentAt,
    lastError: row.metadata_json?.openclawWhatsappPdfLastError,
  })

  console.log('Baixando PDF...')
  const file = await baixarPdf(USER_ID, row.id)
  const buffer = file?.buffer
  if (!buffer?.length) {
    throw new Error('PDF vazio')
  }
  console.log('PDF bytes:', buffer.length)

  const fileName = `NFe-${String(row.id).slice(0, 8)}.pdf`
  console.log('Enviando WhatsApp para', PHONE)
  const result = await sendWhatsappMessage({
    phone: PHONE,
    pdfBase64: Buffer.from(buffer).toString('base64'),
    fileName,
    message: 'Segue a NF-e (produto) emitida.',
    source: 'manual_nfe_resend',
    userId: USER_ID,
    notaId: row.id,
  })
  console.log('Envio OK:', result)

  const meta = {
    ...(row.metadata_json && typeof row.metadata_json === 'object' ? row.metadata_json : {}),
    openclawWhatsappPdfPending: false,
    openclawWhatsappPdfSentAt: new Date().toISOString(),
    openclawWhatsappPhone: PHONE,
    openclawWhatsappPdfLastError: null,
    openclawWhatsappPdfSentChannel: result?.channel || 'zapi',
    source: 'openclaw_whatsapp',
  }

  await client.query(
    'UPDATE mei_nfse SET metadata_json = $1::jsonb, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(meta), row.id],
  )
  console.log('Pronto: PDF marcado como enviado no metadata.')
  await client.end()
}

main().catch((err) => {
  console.error('FALHA:', err?.message || err)
  if (err?.errors) console.error(err.errors)
  process.exit(1)
})
