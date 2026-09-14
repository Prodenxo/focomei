#!/usr/bin/env node
/**
 * Alinha numeração NF-e na PlugNotas antes de emitir (CLI).
 * Uso: node scripts/sync-nfe-numeracao.mjs 67593254000131
 */
import dotenv from 'dotenv';

dotenv.config();

const cnpj = String(process.argv[2] || '').replace(/\D/g, '');
if (cnpj.length !== 14) {
  console.error('Informe o CNPJ (14 dígitos). Ex.: node scripts/sync-nfe-numeracao.mjs 67593254000131');
  process.exit(1);
}

const { ensurePlugnotasNfeNumeracaoBeforeEmit } = await import(
  '../src/services/plugnotas/plugnotas-empresa-nfe-heal.js'
);

const result = await ensurePlugnotasNfeNumeracaoBeforeEmit(cnpj, {
  localMaxNumero: 0,
  relatorioMaxNumero: 0,
});
console.log('OK — próximo número NF-e na PlugNotas:', result);
