#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../../src/config/pg.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../../supabase/migrations');

const check = await query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'empresa_mei_subscription_lines'
  AND column_name IN ('contrato_status', 'contrato_onety_id', 'contrato_signing_url', 'onety_lead_id')
  ORDER BY column_name
`);
console.log('Colunas antes:', check.rows.map((r) => r.column_name));

const files = [
  '20260804190000_mei_subscription_line_approval_contrato.sql',
  '20260820120000_mei_contract_first_billing.sql',
];

for (const file of files) {
  const sql = fs.readFileSync(path.join(root, file), 'utf8');
  try {
    await query(sql);
    console.log('OK migration', file);
  } catch (e) {
    console.error('FAIL', file, e.message);
  }
}

const after = await query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'empresa_mei_subscription_lines'
  AND column_name IN ('contrato_status', 'contrato_onety_id', 'contrato_signing_url', 'onety_lead_id')
  ORDER BY column_name
`);
console.log('Colunas depois:', after.rows.map((r) => r.column_name));
