#!/usr/bin/env node
/**
 * Regenera backend/data/municipios.json a partir de um CSV Plugnotas (TOM/IBGE).
 * O CSV não fica no repo — passe o caminho do arquivo baixado da Plugnotas.
 *
 * Uso:
 *   node backend/scripts/build-municipios-json.mjs /caminho/municipios.csv
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const outPath = path.join(repoRoot, 'backend/data/municipios.json');

const csvPath = process.argv[2] ? path.resolve(process.argv[2]) : '';

if (!csvPath || !existsSync(csvPath)) {
  console.error('Uso: node backend/scripts/build-municipios-json.mjs /caminho/municipios.csv');
  process.exit(1);
}

const buf = readFileSync(csvPath);
let text = buf.toString('utf8');
if (text.includes('\uFFFD')) {
  text = buf.toString('latin1');
}

const lines = text.split(/\r?\n/).filter((line) => line.trim());
const municipios = [];

for (let i = 1; i < lines.length; i += 1) {
  const cols = lines[i].split(';');
  if (cols.length < 5) continue;

  const tom = String(cols[0] || '').trim();
  const ibge = String(cols[1] || '').trim();
  const nomeTom = String(cols[2] || '').trim();
  const nomeIbge = String(cols[3] || '').trim();
  const uf = String(cols[4] || '').trim().toUpperCase().slice(0, 2);

  if (!ibge || uf.length !== 2) continue;

  municipios.push({ tom, ibge, nomeTom, nomeIbge, uf });
}

const payload = JSON.stringify({ version: 1, source: 'plugnotas-tom-ibge', municipios }, null, 0);

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, payload, 'utf8');

console.log(`OK: ${municipios.length} municípios → ${outPath}`);
