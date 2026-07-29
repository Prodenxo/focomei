/**
 * One-time: define senha local (scrypt) e limpa password_reset_required.
 * Uso: node scripts/one-time/set-local-password.mjs <email> <novaSenha>
 */
import 'dotenv/config'
import pg from 'pg'
import { hashPassword } from '../../src/services/local-auth.service.js'

const email = String(process.argv[2] || '').trim().toLowerCase()
const password = String(process.argv[3] || '')

if (!email || !password) {
  console.error('Uso: node scripts/one-time/set-local-password.mjs <email> <novaSenha>')
  process.exit(1)
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL })
await c.connect()

const found = await c.query(
  `SELECT id, raw_user_meta_data FROM public.users WHERE lower(email) = lower($1) LIMIT 1`,
  [email],
)
if (!found.rows[0]) {
  console.error('Usuário não encontrado:', email)
  await c.end()
  process.exit(1)
}

const meta = { ...(found.rows[0].raw_user_meta_data || {}) }
delete meta.password_reset_required

const passwordHash = hashPassword(password)
await c.query(
  `UPDATE public.users
   SET password_hash = $1,
       raw_user_meta_data = $2::jsonb,
       updated_at = now()
   WHERE id = $3`,
  [passwordHash, JSON.stringify(meta), found.rows[0].id],
)

console.log(JSON.stringify({ ok: true, email, userId: found.rows[0].id }, null, 2))
await c.end()
