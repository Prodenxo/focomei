/**
 * Corrige `mei_nfse.created_at` gravado com dia e mês trocados.
 * A PlugNotas envia `dataAutorizacao` como dd/mm/aaaa e o parser antigo lia como mm/dd/aaaa.
 *
 * Uso:
 *   node scripts/one-time/fix-created-at-data-br.mjs            # simula, não grava
 *   node scripts/one-time/fix-created-at-data-br.mjs --apply    # grava
 */
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import pg from 'pg';
import {
  diaCivilBr,
  mesmoDiaCivilBr,
  resolverDataAutorizacaoFiscalDaNota,
} from '../../src/utils/meiLimitePayloadSum.js';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const apply = process.argv.includes('--apply');

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const client = new pg.Client({
  connectionString,
  ssl: /sslmode=disable/i.test(connectionString || '') ? false : { rejectUnauthorized: false },
});
await client.connect();

const { rows } = await client.query(
  `select id, status, created_at, response_json
     from public.mei_nfse
    where response_json is not null`,
);

// Só o dia é corrigido: quando a data já bate, a hora gravada é mais precisa.
const pendentes = [];
for (const row of rows) {
  const fiscalIso = resolverDataAutorizacaoFiscalDaNota(row);
  if (!fiscalIso || !row.created_at) continue;
  if (mesmoDiaCivilBr(row.created_at, fiscalIso)) continue;
  pendentes.push({ id: row.id, status: row.status, de: row.created_at, para: fiscalIso });
}

console.log(`linhas com response_json: ${rows.length}`);
console.log(`linhas com o dia errado: ${pendentes.length}`);
console.table(pendentes.map((p) => ({
  id: String(p.id).slice(0, 8),
  status: p.status,
  de: diaCivilBr(p.de),
  para: diaCivilBr(p.para),
})));

if (!apply) {
  console.log('\nsimulação — rode com --apply para gravar');
} else {
  for (const p of pendentes) {
    await client.query('update public.mei_nfse set created_at = $2 where id = $1', [p.id, p.para]);
  }
  console.log(`\n${pendentes.length} linhas atualizadas`);
}

await client.end();
