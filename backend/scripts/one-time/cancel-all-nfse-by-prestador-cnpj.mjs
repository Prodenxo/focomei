#!/usr/bin/env node
/**
 * Cancela em lote NFS-e concluídas de um prestador (CNPJ) via PlugNotas + banco local.
 *
 * Uso (pasta backend):
 *   node scripts/one-time/cancel-all-nfse-by-prestador-cnpj.mjs --cnpj=65805583000173
 *   node scripts/one-time/cancel-all-nfse-by-prestador-cnpj.mjs --cnpj=65805583000173 --apply
 *   node scripts/one-time/cancel-all-nfse-by-prestador-cnpj.mjs --cnpj=65805583000173 --apply --limit=10
 */
import { createSupabaseClient } from '../../src/config/supabase.js';
import { cancelarNota } from '../../src/services/mei-notas.service.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const cnpjArg = args.find((a) => a.startsWith('--cnpj='));
const limitArg = args.find((a) => a.startsWith('--limit='));
const delayArg = args.find((a) => a.startsWith('--delay-ms='));

const cnpj = String(cnpjArg?.split('=').slice(1).join('=') || '')
  .replace(/\D/g, '');
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1])) : null;
const delayMs = delayArg ? Math.max(0, Number(delayArg.split('=')[1])) : 800;

if (cnpj.length !== 14) {
  console.error('Informe --cnpj= com 14 dígitos (ex.: 65805583000173).');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const stripDiacritics = (value) => String(value || '')
  .normalize('NFD')
  .replace(/\p{M}/gu, '');

const normalizeStatus = (value) => {
  const ascii = stripDiacritics(String(value || '')).toUpperCase();
  if (!ascii) return 'processando';
  if (ascii.includes('CANCELAMENTO_PENDENTE') || (ascii.includes('CANCELAMENTO') && ascii.includes('PENDENTE'))) {
    return 'cancelamento_pendente';
  }
  if (ascii.includes('CONCLUIDO') || ascii.includes('CONCLUIDA') || ascii.includes('AUTORIZ')) return 'concluido';
  if (ascii.includes('PROCESS')) return 'processando';
  if (ascii.includes('REJEIT')) return 'rejeitado';
  if (ascii.includes('CANCEL')) return 'cancelado';
  if (ascii.includes('INTERROMP')) return 'interrompido';
  return String(value || '').toLowerCase();
};

const canCancel = (status) => {
  const key = normalizeStatus(status);
  return key === 'concluido' || key === 'processando' || key === 'cancelamento_pendente';
};

const db = createSupabaseClient({ useServiceRole: true });

const loadCandidates = async () => {
  const { data, error } = await db
    .from('mei_nfse')
    .select('id, user_id, status, document_type, plugnotas_id, id_integracao, protocol, cnpj_prestador, created_at')
    .eq('cnpj_prestador', cnpj)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  let rows = (data || []).filter((row) => {
    const dt = String(row.document_type || 'NFSE').toUpperCase();
    return dt === 'NFSE' || dt === '';
  });

  if (!rows.length) {
    const { data: fallback, error: fbErr } = await db
      .from('mei_nfse')
      .select('id, user_id, status, document_type, plugnotas_id, id_integracao, protocol, cnpj_prestador, created_at, payload_json')
      .order('created_at', { ascending: true });
    if (fbErr) throw new Error(fbErr.message);
    rows = (fallback || []).filter((row) => {
      const prest = row?.payload_json?.prestador?.cpfCnpj
        ?? row?.payload_json?.prestador?.cnpj;
      const doc = String(prest || '').replace(/\D/g, '');
      const dt = String(row.document_type || 'NFSE').toUpperCase();
      return doc === cnpj && (dt === 'NFSE' || dt === '');
    });
  }

  return rows.filter((row) => canCancel(row.status));
};

const reason = 'Cancelamento em lote solicitado pelo contribuinte (CNPJ prestador).';

const main = async () => {
  console.log(`CNPJ prestador: ${cnpj}`);
  console.log(`Modo: ${apply ? 'APLICAR (cancelar na PlugNotas + banco)' : 'DRY-RUN (só listar)'}`);
  const candidates = await loadCandidates();
  const slice = limit ? candidates.slice(0, limit) : candidates;

  const byStatus = candidates.reduce((acc, row) => {
    const k = normalizeStatus(row.status);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  console.log(`Notas elegíveis para cancelamento: ${candidates.length}`);
  console.log('Por status:', byStatus);
  if (limit) console.log(`Limite desta execução: ${limit}`);

  if (!slice.length) {
    console.log('Nenhuma nota para cancelar.');
    return;
  }

  console.log('\nAmostra (até 5):');
  for (const row of slice.slice(0, 5)) {
    console.log(
      `  - ${row.id} | user=${row.user_id} | status=${row.status} | plug=${row.plugnotas_id || '-'} | int=${row.id_integracao || '-'}`,
    );
  }

  if (!apply) {
    console.log('\nDry-run concluído. Reexecute com --apply para cancelar.');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < slice.length; i += 1) {
    const row = slice[i];
    process.stdout.write(`[${i + 1}/${slice.length}] ${row.id} … `);
    try {
      const updated = await cancelarNota(row.user_id, row.id, { reason });
      const st = normalizeStatus(updated?.status);
      console.log(st);
      ok += 1;
    } catch (err) {
      console.log(`ERRO: ${err?.message || err}`);
      fail += 1;
    }
    if (i < slice.length - 1 && delayMs > 0) await sleep(delayMs);
  }

  console.log(`\nConcluído. Sucesso: ${ok}, falhas: ${fail}, total: ${slice.length}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
