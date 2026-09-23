import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const email = process.argv[2];
const competencia = process.argv[3] || '202608';

if (!email) {
  console.error('uso: node scripts/probe-das-periodo.mjs <email> [AAAAMM]');
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

if (!rows[0]) {
  console.error('usuario sem registro de certificado/CNPJ');
  process.exit(1);
}

const { user_id: userId, cert_document: cnpj, tem_pfx: temPfx } = rows[0];
console.log({ userId, cnpj, temPfx, competencia });

const guide = await import('../src/services/mei-guide.service.js');

try {
  const result = temPfx
    ? await guide.createGuide(userId, { cnpj, periodoApuracao: competencia, skipLocalPdf: true })
    : await guide.createGuideByCnpj(userId, { cnpj, periodoApuracao: competencia, skipLocalPdf: true });
  console.log('\nOK:', JSON.stringify(result).slice(0, 600));
} catch (error) {
  console.log('\nFALHOU');
  console.log('message:', error?.message);
  console.log('status:', error?.status);
  console.log('code:', error?.code);
  if (error?.details) console.log('details:', JSON.stringify(error.details).slice(0, 800));
  if (error?.cause) console.log('cause:', String(error.cause).slice(0, 400));
}
