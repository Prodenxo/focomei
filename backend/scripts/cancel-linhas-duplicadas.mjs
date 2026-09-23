import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const empresaId = process.argv[2];
const manterLineId = process.argv[3];
const commit = process.argv.includes('--commit');

if (!empresaId || !manterLineId) {
  console.error('uso: node scripts/cancel-linhas-duplicadas.mjs <empresaId> <lineIdParaManter> [--commit]');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const client = new pg.Client({
  connectionString,
  ssl: /sslmode=disable/i.test(connectionString) ? false : { rejectUnauthorized: false },
});
await client.connect();
await client.query('BEGIN');

try {
  const { rows } = await client.query(
    `UPDATE public.empresa_mei_subscription_lines
     SET status = 'cancelled',
         contrato_status = 'skipped',
         contrato_error = 'Linha duplicada cancelada pelo suporte (cliques repetidos com robo CRM fora do ar)',
         updated_at = now()
     WHERE empresa_id = $1
       AND status = 'pending'
       AND id <> $2
     RETURNING id, mei_slots, value_numeric, status`,
    [empresaId, manterLineId],
  );

  console.log(`linhas canceladas: ${rows.length}`);
  for (const r of rows) console.log('  * ' + JSON.stringify(r));

  const { rows: restantes } = await client.query(
    `SELECT id, mei_slots, value_numeric, status, contrato_status
     FROM public.empresa_mei_subscription_lines
     WHERE empresa_id = $1
     ORDER BY created_at DESC`,
    [empresaId],
  );
  console.log('\nestado final:');
  for (const r of restantes) console.log('  * ' + JSON.stringify(r));

  if (commit) {
    await client.query('COMMIT');
    console.log('\nCOMMIT aplicado.');
  } else {
    await client.query('ROLLBACK');
    console.log('\nROLLBACK (simulacao). Rode com --commit para aplicar.');
  }
} catch (error) {
  await client.query('ROLLBACK');
  console.error('erro, rollback aplicado:', error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
