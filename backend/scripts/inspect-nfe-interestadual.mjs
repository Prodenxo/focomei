/**
 * Mostra quem jÃ¡ aceitou o termo de NF-e interestadual, as alÃ­quotas cadastradas
 * e as Ãºltimas notas NF-e com erro â€” para diagnosticar recusa de emissÃ£o.
 * Uso: node scripts/inspect-nfe-interestadual.mjs [--email alguem@dominio.com]
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

const tabelas = await client.query(
  `select table_name from information_schema.tables
    where table_schema = 'public'
      and (table_name like '%nota%' or table_name like '%interestadual%' or table_name like '%nf%')
    order by table_name`,
);
console.log('### tabelas relacionadas');
console.log(tabelas.rows.map((r) => r.table_name).join('\n') || '(nenhuma)');

const temTabela = (nome) => tabelas.rows.some((r) => r.table_name === nome);

if (temTabela('mei_nfe_interestadual_consent')) {
  const consent = await client.query(
    `select u.email, c.accepted_at, c.terms_version
       from public.mei_nfe_interestadual_consent c
       join public.users u on u.id = c.user_id
      where ($1::text is null or lower(u.email) = lower($1))
      order by c.accepted_at desc nulls last
      limit 20`,
    [email],
  );
  console.log('\n### termo interestadual aceito');
  console.table(consent.rows);
}

if (temTabela('mei_nfe_interestadual_taxas')) {
  const taxas = await client.query(
    `select u.email, t.uf_destino, t.aliquota_icms, t.csosn, t.cfop
       from public.mei_nfe_interestadual_taxas t
       join public.users u on u.id = t.user_id
      where ($1::text is null or lower(u.email) = lower($1))
      order by u.email, t.uf_destino
      limit 30`,
    [email],
  );
  console.log('\n### alÃ­quotas por UF');
  console.table(taxas.rows);
}

const notas = tabelas.rows
  .map((r) => r.table_name)
  .find((nome) => /^mei_notas$|^notas$|^notas_fiscais$/.test(nome));

if (notas) {
  const colunas = await client.query(
    `select column_name from information_schema.columns
      where table_schema = 'public' and table_name = $1`,
    [notas],
  );
  const nomes = colunas.rows.map((r) => r.column_name);
  const colErro = nomes.find((n) => /erro|error/.test(n));
  const colData = nomes.find((n) => /created_at|updated_at/.test(n));
  if (colErro && colData) {
    const erros = await client.query(
      `select u.email, n.${colErro} as erro, n.${colData} as quando
         from public.${notas} n
         left join public.users u on u.id = n.user_id
        where n.${colErro} is not null
          and ($1::text is null or lower(u.email) = lower($1))
        order by n.${colData} desc
        limit 15`,
      [email],
    );
    console.log(`\n### Ãºltimos erros em ${notas}`);
    console.table(erros.rows.map((r) => ({
      email: r.email,
      quando: String(r.quando).slice(0, 19),
      erro: String(r.erro || '').slice(0, 90),
    })));
  }
}

await client.end();
