/**
 * Mostra o espelho fiscal do prestador (NFS-e) e quais campos faltam para emitir pelo bot.
 * Uso: node scripts/inspect-emitente-nfse.mjs [--email alguem@dominio.com]
 */
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
};

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const client = new pg.Client({
  connectionString,
  ssl: /sslmode=disable/i.test(connectionString || '') ? false : { rejectUnauthorized: false },
});
await client.connect();

const email = arg('email');
const { rows } = await client.query(
  `select u.email,
          c.user_id,
          c.cert_document,
          c.razao_social,
          c.cep,
          c.tipo_logradouro,
          c.logradouro,
          c.numero,
          c.bairro,
          c.ibge_municipio,
          c.cidade,
          c.uf,
          c.inscricao_municipal,
          c.plugnotas_cert_id is not null as tem_plugnotas_cert,
          c.cert_valid_to,
          c.updated_at
     from public.user_mei_certificates c
     join public.users u on u.id = c.user_id
    where ($1::text is null or lower(u.email) = lower($1))
    order by c.updated_at desc
    limit 30`,
  [email],
);

const digits = (value) => String(value ?? '').replace(/\D+/g, '');

const faltando = (row) => {
  const missing = [];
  if (digits(row.cert_document).length !== 14) missing.push('cnpj');
  if (!String(row.logradouro || '').trim()) missing.push('logradouro');
  if (!String(row.numero || '').trim()) missing.push('numero');
  if (!String(row.ibge_municipio || '').trim()) missing.push('codigo_ibge');
  if (digits(row.cep).length !== 8) missing.push('cep');
  return missing.join(', ') || 'ok';
};

console.table(rows.map((row) => ({
  email: row.email,
  cnpj: row.cert_document,
  razao: (row.razao_social || '').slice(0, 24),
  cep: row.cep,
  logradouro: (row.logradouro || '').slice(0, 22),
  numero: row.numero,
  ibge: row.ibge_municipio,
  uf: row.uf,
  im: row.inscricao_municipal,
  plug: row.tem_plugnotas_cert,
  vence: row.cert_valid_to ? String(row.cert_valid_to).slice(0, 10) : null,
  falta: faltando(row),
})));

await client.end();
