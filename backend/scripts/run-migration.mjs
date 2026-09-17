import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const [, , fileArg, ...flags] = process.argv;
const commit = flags.includes('--commit');

if (!fileArg) {
  console.error('Uso: node scripts/run-migration.mjs <arquivo.sql> [--commit]');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('DATABASE_URL não configurado');
  process.exit(1);
}

const sqlPath = path.resolve(fileArg);
const sql = await fs.readFile(sqlPath, 'utf8');

const client = new pg.Client({
  connectionString,
  ssl: /sslmode=disable/i.test(connectionString) ? false : { rejectUnauthorized: false },
});

await client.connect();

try {
  await client.query('BEGIN');
  await client.query(sql);
  await client.query(commit ? 'COMMIT' : 'ROLLBACK');
  console.log(
    commit
      ? `Migração aplicada: ${path.basename(sqlPath)}`
      : `Ensaio OK (revertido): ${path.basename(sqlPath)}`,
  );
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(`Falha na migração: ${error.message}`);
  if (error.position) console.error(`Posição: ${error.position}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
