import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const sqlPath = path.join(root, 'db/easypanel/010_nfe_interestadual.sql')
const sql = fs.readFileSync(sqlPath, 'utf8')

const c = new pg.Client({ connectionString: process.env.DATABASE_URL })
await c.connect()
await c.query(sql)
const r = await c.query(`
  SELECT
    to_regclass('public.mei_nfe_interestadual_consent') AS consent,
    to_regclass('public.mei_nfe_interestadual_taxas') AS taxas
`)
console.log(r.rows[0])
await c.end()
