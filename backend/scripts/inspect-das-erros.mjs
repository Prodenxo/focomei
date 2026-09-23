import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const client = new pg.Client({
  connectionString,
  ssl: /sslmode=disable/i.test(connectionString) ? false : { rejectUnauthorized: false },
});
await client.connect();

const { rows: resumo } = await client.query(
  `SELECT status, count(*) AS total, max(updated_at) AS ultimo
   FROM public.das_mensal_status
   GROUP BY status
   ORDER BY total DESC`,
);
console.log('### status geral');
console.table(resumo);

const { rows: erros } = await client.query(
  `SELECT error_message, count(*) AS total, min(competencia) AS de, max(competencia) AS ate,
          max(updated_at) AS ultimo
   FROM public.das_mensal_status
   WHERE status = 'erro'
   GROUP BY error_message
   ORDER BY total DESC
   LIMIT 15`,
);
console.log('\n### mensagens de erro mais comuns');
for (const e of erros) {
  console.log(`* (${e.total}) ${e.de}..${e.ate} | ${e.ultimo?.toISOString?.() || e.ultimo}`);
  console.log(`  ${String(e.error_message).slice(0, 400)}`);
}

const { rows: recentes } = await client.query(
  `SELECT d.competencia, d.status, d.source, d.updated_at, u.email,
          left(coalesce(d.error_message, ''), 300) AS erro
   FROM public.das_mensal_status d
   LEFT JOIN public.users u ON u.id = d.user_id
   ORDER BY d.updated_at DESC
   LIMIT 15`,
);
console.log('\n### ultimos registros');
for (const r of recentes) {
  console.log(`* ${r.competencia} | ${r.status} | ${r.source} | ${r.email} | ${r.updated_at?.toISOString?.() || r.updated_at}`);
  if (r.erro) console.log(`  ${r.erro}`);
}

const { rows: jobs } = await client.query(
  `SELECT * FROM public.das_mensal_job_runs ORDER BY created_at DESC LIMIT 5`,
);
console.log('\n### ultimas execucoes do robo');
for (const j of jobs) console.log('* ' + JSON.stringify(j).slice(0, 700));

await client.end();
