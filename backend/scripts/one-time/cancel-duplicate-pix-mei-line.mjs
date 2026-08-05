#!/usr/bin/env node
/**
 * Cancela linha PIX MEI duplicada (mantém a mais antiga) para uma empresa por CNPJ.
 *
 * Uso:
 *   node backend/scripts/one-time/cancel-duplicate-pix-mei-line.mjs 65805583000173
 */
import { createClient } from '@supabase/supabase-js'

const cnpjArg = String(process.argv[2] || '').replace(/\D/g, '')
if (cnpjArg.length !== 14) {
  console.error('Informe CNPJ com 14 dígitos. Ex.: node cancel-duplicate-pix-mei-line.mjs 65805583000173')
  process.exit(1)
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false } })

const { data: empresa, error: empErr } = await admin
  .from('empresas')
  .select('id, empresa, razao_social, cnpj, legacy_mei_slots_pix, max_mei')
  .eq('cnpj', cnpjArg)
  .maybeSingle()

if (empErr || !empresa?.id) {
  console.error('Empresa não encontrada:', empErr?.message || cnpjArg)
  process.exit(1)
}

const { data: lines, error: lineErr } = await admin
  .from('empresa_mei_subscription_lines')
  .select('id, mei_slots, status, billing_type, created_at, external_reference')
  .eq('empresa_id', empresa.id)
  .eq('billing_type', 'pix_manual')
  .eq('status', 'active')
  .order('created_at', { ascending: true })

if (lineErr) {
  console.error('Erro ao listar linhas:', lineErr.message)
  process.exit(1)
}

if (!lines?.length || lines.length < 2) {
  console.log('Nenhuma duplicata PIX ativa encontrada.', lines?.length || 0, 'linha(s)')
  process.exit(0)
}

const toCancel = lines[lines.length - 1]
const toKeep = lines[0]

console.log('Empresa:', empresa.razao_social || empresa.empresa, empresa.id)
console.log('Manter:', toKeep.id, toKeep.created_at, `${toKeep.mei_slots} vagas`)
console.log('Cancelar:', toCancel.id, toCancel.created_at, `${toCancel.mei_slots} vagas`)

const { error: upErr } = await admin
  .from('empresa_mei_subscription_lines')
  .update({ status: 'cancelled', updated_at: new Date().toISOString() })
  .eq('id', toCancel.id)

if (upErr) {
  console.error('Falha ao cancelar:', upErr.message)
  process.exit(1)
}

const legacyPix = Math.max(
  0,
  Number(empresa.legacy_mei_slots_pix || 0) - Number(toCancel.mei_slots || 0),
)
await admin.from('empresas').update({ legacy_mei_slots_pix: legacyPix }).eq('id', empresa.id)

const { data: activeLines } = await admin
  .from('empresa_mei_subscription_lines')
  .select('mei_slots')
  .eq('empresa_id', empresa.id)
  .eq('status', 'active')

const maxMei = (activeLines || []).reduce((acc, row) => acc + Number(row.mei_slots || 0), 0)
await admin.from('empresas').update({ max_mei: maxMei }).eq('id', empresa.id)

console.log('OK — max_mei atualizado para', maxMei)
