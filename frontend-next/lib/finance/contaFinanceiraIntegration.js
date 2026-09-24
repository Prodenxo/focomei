import { normalizarTipo, normalizarValor } from './dashboardUtils.js';
import { computeContaSaldoAtual, isRealizedLancamentoStatus } from './contaSaldo.js';

/** Porte fiel de `frontend/lib/contaFinanceiraIntegration.ts`. */

export function buildContaNameMap(contas) {
  const map = {};
  for (const c of contas) {
    if (c.ativo) map[c.id] = c.nome;
  }
  return map;
}

export function computeSaldosByConta(contas, lancamentos) {
  const out = {};
  for (const c of contas.filter((x) => x.ativo)) {
    out[c.id] = computeContaSaldoAtual(c.saldo_inicial, lancamentos, c.id);
  }
  return out;
}

export function sumSaldosContas(contas, lancamentos) {
  return contas
    .filter((c) => c.ativo)
    .reduce((sum, c) => sum + computeContaSaldoAtual(c.saldo_inicial, lancamentos, c.id), 0);
}

/** Lançamentos sem conta vinculada (realizados) — legado / migração. */
export function sumUnassignedRealizedDelta(lancamentos) {
  let delta = 0;
  for (const tx of lancamentos) {
    if (tx.conta_id) continue;
    if (!isRealizedLancamentoStatus(tx.status)) continue;
    const v = normalizarValor(tx.valor);
    delta += normalizarTipo(tx.tipo) === 'entrada' ? v : -v;
  }
  return delta;
}

export function matchesContaFilter(tx, filter) {
  if (filter === 'all') return true;
  if (filter === 'unassigned') return !tx.conta_id;
  return String(tx.conta_id || '') === filter;
}

export function filterTransactionsByConta(list, filter) {
  if (filter === 'all') return list;
  return list.filter((t) => matchesContaFilter(t, filter));
}

export function computeMonthFlowKpis(list) {
  const isEntrada = (t) => normalizarTipo(t.tipo) === 'entrada';
  const valorOf = (t) => normalizarValor(t.valor);
  const entradas = list.filter(isEntrada).reduce((s, t) => s + valorOf(t), 0);
  const saidas = list.filter((t) => !isEntrada(t)).reduce((s, t) => s + valorOf(t), 0);
  return {
    entradas,
    saidas,
    saldo: entradas - saidas,
    countEntradas: list.filter(isEntrada).length,
    countSaidas: list.filter((t) => !isEntrada(t)).length,
  };
}

/** Saldo exibido no dashboard conforme o filtro de conta ativo. */
export function resolveDashboardBalance(contas, lancamentos, legacyAllTxBalance, filter) {
  const ativas = contas.filter((c) => c.ativo);

  if (filter === 'unassigned') {
    return { value: sumUnassignedRealizedDelta(lancamentos), mode: 'unassigned' };
  }

  if (filter !== 'all') {
    const conta = ativas.find((c) => c.id === filter);
    if (conta) {
      return {
        value: computeContaSaldoAtual(conta.saldo_inicial, lancamentos, filter),
        mode: 'contas',
      };
    }
  }

  if (ativas.length === 0) {
    return { value: legacyAllTxBalance, mode: 'legacy' };
  }

  let total = sumSaldosContas(ativas, lancamentos);
  if (filter === 'all') {
    total += sumUnassignedRealizedDelta(lancamentos);
  }
  return { value: total, mode: 'contas' };
}

/** Saldo "legado": todos os lançamentos realizados, sem olhar conta. */
export function computeLegacyBalance(transactions) {
  let sum = 0;
  for (const t of transactions) {
    if (!isRealizedLancamentoStatus(t.status)) continue;
    const val = normalizarValor(t.valor);
    sum += normalizarTipo(t.tipo) === 'entrada' ? val : -val;
  }
  return sum;
}
