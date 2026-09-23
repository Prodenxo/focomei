import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const email = process.argv[2];
if (!email) {
  console.error('uso: node scripts/probe-das-periodos-lista.mjs <email>');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const client = new pg.Client({
  connectionString,
  ssl: /sslmode=disable/i.test(connectionString) ? false : { rejectUnauthorized: false },
});
await client.connect();
const { rows } = await client.query(
  `SELECT c.user_id, c.cert_document, (c.pfx_base64 IS NOT NULL) AS tem_pfx
   FROM public.user_mei_certificates c
   JOIN public.users u ON u.id = c.user_id
   WHERE u.email = $1`,
  [email],
);
await client.end();

if (!rows[0]?.cert_document) {
  console.error('usuario sem CNPJ salvo');
  process.exit(1);
}

const { user_id: userId, cert_document: cnpj, tem_pfx: temPfx } = rows[0];
console.log({ userId, cnpj, temPfx });

const guide = await import('../src/services/mei-guide.service.js');

const periods = temPfx
  ? await guide.listPeriods(userId, { cnpj, refresh: true })
  : await guide.listPeriodsByCnpj(userId, { cnpj, refresh: true });

const lista = Array.isArray(periods) ? periods : periods?.periods || periods?.items || [];
console.log(`\n### competencias retornadas: ${lista.length}`);
for (const p of lista) {
  console.log(`* ${p.competencia} | ${p.status}${p.errorMessage ? ` | ${p.errorMessage}` : ''}`);
}
