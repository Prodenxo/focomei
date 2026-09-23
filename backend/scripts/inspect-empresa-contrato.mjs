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

const termo = process.argv[2] || 'AST';

const { rows: empresas } = await client.query(
  `SELECT id, empresa, razao_social, nome_fantasia, email, telefone,
          max_mei, access_status, status, created_at
   FROM public.empresas
   WHERE empresa ILIKE $1 OR razao_social ILIKE $1 OR nome_fantasia ILIKE $1
   ORDER BY created_at DESC
   LIMIT 5`,
  [`%${termo}%`],
);

console.log(`### empresas encontradas: ${empresas.length}`);
for (const e of empresas) {
  console.log('\n-----------------------------');
  console.log(JSON.stringify(e, null, 2));

  const { rows: linhas } = await client.query(
    `SELECT * FROM public.empresa_mei_subscription_lines
     WHERE empresa_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [e.id],
  );
  console.log(`\n  linhas de assinatura: ${linhas.length}`);
  for (const l of linhas) {
    const resumo = Object.fromEntries(
      Object.entries(l).filter(([, v]) => v !== null && v !== ''),
    );
    console.log('  * ' + JSON.stringify(resumo).slice(0, 1200));
  }

  const { rows: users } = await client.query(
    `SELECT u.id, u.email, p.role, rx.status, rx.created_at
     FROM public.role_x_user_x_empresa rx
     JOIN public.users u ON u.id = rx.user_id
     LEFT JOIN public.profiles p ON p.id = u.id
     WHERE rx.empresas_id = $1
     ORDER BY rx.created_at DESC
     LIMIT 5`,
    [e.id],
  );
  console.log(`\n  usuarios vinculados: ${users.length}`);
  for (const u of users) console.log(`  * ${u.email} | role=${u.role} | ativo=${u.status}`);
}

await client.end();
