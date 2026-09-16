import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizarTipo, normalizarValor, parsearData } from '../lib/finance/dashboardUtils.js';
import { computeContaSaldoAtual, isRealizedLancamentoStatus } from '../lib/finance/contaSaldo.js';
import { isInSelectedMonth, parseTransactionDate } from '../lib/finance/transactionPeriodFilter.js';
import {
  computeLegacyBalance,
  filterTransactionsByConta,
  resolveDashboardBalance,
  sumUnassignedRealizedDelta,
} from '../lib/finance/contaFinanceiraIntegration.js';
import {
  buildDashboardInsights,
  buildRecentActivity,
  buildTodayFlow,
} from '../lib/finance/dashboardInsights.js';
import {
  bucketBudgets,
  buildBpoCategorySeries,
  buildCategorizedBudgets,
  buildDespesasPorCategoria,
  buildSaldoSeries,
  computeMonthRealizedFlow,
} from '../lib/finance/visaoGeral.js';
import { buildBpoMatrixViewModel } from '../lib/finance/bpoMatrix.js';
import { pickDefaultContaFinanceira } from '../lib/finance/contaPadrao.js';
import { normalizeTransactionRow } from '../lib/finance/normalizadores.js';

const conta = (id, saldoInicial, extra = {}) => ({
  id,
  nome: `Conta ${id}`,
  tipo: 'corrente',
  saldo_inicial: saldoInicial,
  ativo: true,
  criado_em: '2026-01-01T00:00:00Z',
  ...extra,
});

const tx = (over = {}) => ({
  id: 't',
  tipo: 'entrada',
  valor: 100,
  status: 'recebido',
  data: '2026-09-10',
  criado_em: '2026-09-10T10:00:00Z',
  classificacao: 'Venda',
  categoria: null,
  conta_id: null,
  ...over,
});

test('normalizarTipo trata "saída" e vazio como saida', () => {
  assert.equal(normalizarTipo('entrada'), 'entrada');
  assert.equal(normalizarTipo('ENTRADA '), 'entrada');
  assert.equal(normalizarTipo('saída'), 'saida');
  assert.equal(normalizarTipo(''), 'saida');
  assert.equal(normalizarTipo(null), 'saida');
});

test('normalizarValor aceita número, string e lixo', () => {
  assert.equal(normalizarValor(12.5), 12.5);
  assert.equal(normalizarValor('12.5'), 12.5);
  assert.equal(normalizarValor('abc'), 0);
  assert.equal(normalizarValor(null), 0);
  assert.equal(normalizarValor(NaN), 0);
});

test('parsearData usa criado_em quando não há data', () => {
  assert.equal(parsearData('2026-09-10', '').getFullYear(), 2026);
  assert.equal(parsearData(null, '2026-03-04T00:00:00Z').getUTCMonth(), 2);
});

test('apenas pago e recebido contam como realizados', () => {
  assert.equal(isRealizedLancamentoStatus('pago'), true);
  assert.equal(isRealizedLancamentoStatus('RECEBIDO'), true);
  assert.equal(isRealizedLancamentoStatus('a_pagar'), false);
  assert.equal(isRealizedLancamentoStatus(null), false);
});

test('computeContaSaldoAtual soma só os realizados da própria conta', () => {
  const lancamentos = [
    tx({ conta_id: 'c1', tipo: 'entrada', valor: 500, status: 'recebido' }),
    tx({ conta_id: 'c1', tipo: 'saida', valor: 200, status: 'pago' }),
    tx({ conta_id: 'c1', tipo: 'saida', valor: 999, status: 'a_pagar' }),
    tx({ conta_id: 'c2', tipo: 'saida', valor: 50, status: 'pago' }),
    tx({ conta_id: null, tipo: 'entrada', valor: 70, status: 'recebido' }),
  ];
  assert.equal(computeContaSaldoAtual(1000, lancamentos, 'c1'), 1300);
});

test('isInSelectedMonth respeita o mês escolhido', () => {
  assert.equal(isInSelectedMonth(tx({ data: '2026-09-01' }), { year: 2026, month: 9 }), true);
  assert.equal(isInSelectedMonth(tx({ data: '2026-08-31' }), { year: 2026, month: 9 }), false);
  assert.equal(parseTransactionDate({ data: '2026-09-10' }).getDate(), 10);
});

test('resolveDashboardBalance cobre os três modos', () => {
  const contas = [conta('c1', 100), conta('c2', 50)];
  const lancamentos = [
    tx({ conta_id: 'c1', tipo: 'entrada', valor: 400, status: 'recebido' }),
    tx({ conta_id: null, tipo: 'entrada', valor: 25, status: 'recebido' }),
  ];
  const legado = computeLegacyBalance(lancamentos);

  assert.deepEqual(resolveDashboardBalance(contas, lancamentos, legado, 'all'), {
    value: 575,
    mode: 'contas',
  });
  assert.deepEqual(resolveDashboardBalance(contas, lancamentos, legado, 'c1'), {
    value: 500,
    mode: 'contas',
  });
  assert.deepEqual(resolveDashboardBalance(contas, lancamentos, legado, 'unassigned'), {
    value: 25,
    mode: 'unassigned',
  });
  assert.deepEqual(resolveDashboardBalance([], lancamentos, legado, 'all'), {
    value: 425,
    mode: 'legacy',
  });
});

test('sumUnassignedRealizedDelta ignora conta vinculada e pendentes', () => {
  const lancamentos = [
    tx({ conta_id: null, tipo: 'entrada', valor: 100, status: 'recebido' }),
    tx({ conta_id: null, tipo: 'saida', valor: 40, status: 'pago' }),
    tx({ conta_id: null, tipo: 'saida', valor: 900, status: 'a_pagar' }),
    tx({ conta_id: 'c1', tipo: 'entrada', valor: 700, status: 'recebido' }),
  ];
  assert.equal(sumUnassignedRealizedDelta(lancamentos), 60);
});

test('filterTransactionsByConta devolve a mesma lista em "all"', () => {
  const lista = [tx({ conta_id: 'c1' }), tx({ conta_id: null })];
  assert.equal(filterTransactionsByConta(lista, 'all'), lista);
  assert.equal(filterTransactionsByConta(lista, 'unassigned').length, 1);
  assert.equal(filterTransactionsByConta(lista, 'c1').length, 1);
});

test('indicadores principais usam só realizados', () => {
  const mes = [
    tx({ tipo: 'entrada', valor: 1000, status: 'recebido' }),
    tx({ tipo: 'entrada', valor: 500, status: 'a_receber' }),
    tx({ tipo: 'saida', valor: 300, status: 'pago' }),
    tx({ tipo: 'saida', valor: 200, status: 'a_pagar' }),
  ];
  assert.deepEqual(computeMonthRealizedFlow(mes), { totalIncome: 1000, totalExpenses: 300 });
});

test('resumo soma todos os status, inclusive pendentes (divergência preservada)', () => {
  const lista = [
    tx({ tipo: 'entrada', valor: 1000, status: 'recebido' }),
    tx({ tipo: 'entrada', valor: 500, status: 'a_receber' }),
    tx({ tipo: 'saida', valor: 300, status: 'a_pagar' }),
  ];
  const insights = buildDashboardInsights(lista, 2026, 9);
  const porId = Object.fromEntries(insights.map((i) => [i.id, i]));

  // receita 1500 − despesa 300 = 1200, ou seja: o pendente entra na conta.
  assert.match(porId.net.value, /1\.200,00/);
  assert.equal(porId.savings.value, '80%');
  assert.equal(porId.tx.value, '3');
  assert.match(porId.pending.value, /300,00/);
  assert.equal(porId.pending.hint, '1 conta ainda não paga');
});

test('sem receita, "quanto sobrou" vira 0% e não menos infinito', () => {
  const insights = buildDashboardInsights(
    [tx({ tipo: 'saida', valor: 100, status: 'pago' })],
    2026,
    9,
  );
  assert.equal(insights.find((i) => i.id === 'savings').value, '0%');
});

test('comparação com o mês passado some quando não houve despesa antes', () => {
  const semMesAnterior = buildDashboardInsights(
    [tx({ tipo: 'saida', valor: 100, status: 'pago', data: '2026-09-10' })],
    2026,
    9,
  );
  assert.equal(semMesAnterior.some((i) => i.id === 'delta'), false);

  const comMesAnterior = buildDashboardInsights(
    [
      tx({ tipo: 'saida', valor: 50, status: 'pago', data: '2026-08-10' }),
      tx({ tipo: 'saida', valor: 100, status: 'pago', data: '2026-09-10' }),
    ],
    2026,
    9,
  );
  const delta = comMesAnterior.find((i) => i.id === 'delta');
  assert.equal(delta.value, '+100,0%');
  assert.equal(delta.tone, 'negative');
});

test('gasto por dia divide pelos dias do mês selecionado', () => {
  const insights = buildDashboardInsights(
    [tx({ tipo: 'saida', valor: 300, status: 'pago', data: '2026-09-10' })],
    2026,
    9,
  );
  const avg = insights.find((i) => i.id === 'avg');
  assert.match(avg.value, /10,00/); // 300 / 30 dias
  assert.equal(avg.hint, 'Média de despesas nos 30 dias do mês');
});

test('buildTodayFlow considera só o dia de referência e só realizados', () => {
  const hoje = new Date(2026, 8, 16);
  const fluxo = buildTodayFlow(
    [
      tx({ tipo: 'entrada', valor: 200, status: 'recebido', data: '2026-09-16' }),
      tx({ tipo: 'saida', valor: 80, status: 'pago', data: '2026-09-16' }),
      tx({ tipo: 'saida', valor: 999, status: 'a_pagar', data: '2026-09-16' }),
      tx({ tipo: 'entrada', valor: 999, status: 'recebido', data: '2026-09-15' }),
    ],
    hoje,
  );
  assert.equal(fluxo.income, 200);
  assert.equal(fluxo.expense, 80);
  assert.equal(fluxo.dayKey, '2026-09-16');
});

test('últimas movimentações vêm da mais recente e respeitam o limite', () => {
  const itens = buildRecentActivity(
    [
      tx({ valor: 1, data: '2026-09-01' }),
      tx({ valor: 2, data: '2026-09-20' }),
      tx({ valor: 3, data: '2026-09-10' }),
    ],
    2026,
    9,
    {},
    2,
  );
  assert.equal(itens.length, 2);
  assert.match(itens[0].amount, /2,00/);
  assert.match(itens[1].amount, /3,00/);
});

test('evolução do saldo acumula por dia só o realizado', () => {
  const { dayKeys, saldoData } = buildSaldoSeries([
    tx({ tipo: 'entrada', valor: 100, status: 'recebido', data: '2026-09-01' }),
    tx({ tipo: 'saida', valor: 30, status: 'pago', data: '2026-09-02' }),
    tx({ tipo: 'saida', valor: 500, status: 'a_pagar', data: '2026-09-03' }),
  ]);
  assert.deepEqual(dayKeys, ['2026-09-01', '2026-09-02']);
  assert.deepEqual(saldoData, [100, 70]);
});

test('movimentações do mês separam pagos de a pagar', () => {
  const resultado = buildDespesasPorCategoria([
    tx({ tipo: 'saida', valor: 100, status: 'pago', categoria: 7 }),
    tx({ tipo: 'saida', valor: 50, status: 'pago', categoria: 7 }),
    tx({ tipo: 'saida', valor: 25, status: 'a_pagar', categoria: null, classificacao: 'Luz' }),
    tx({ tipo: 'entrada', valor: 900, status: 'recebido' }),
  ]);
  assert.deepEqual(resultado.expensesByCategoryPagos, { 7: 150 });
  assert.deepEqual(resultado.expensesByCategoryAPagar, { Luz: 25 });
  assert.equal(resultado.totalPagos, 150);
  assert.equal(resultado.totalAPagar, 25);
});

test('faixas do orçamento se invertem entre entrada e saída', () => {
  const orcamentos = buildCategorizedBudgets(
    [
      { categorias_id: 1, valor_orcado: 100, valor_gasto: 90, valor_recebido: 0 },
      { categorias_id: 2, valor_orcado: 100, valor_gasto: 0, valor_recebido: 90 },
      { categorias_id: 3, valor_orcado: 0, valor_gasto: 10, valor_recebido: 0 },
    ],
    { 1: 'Aluguel', 2: 'Vendas' },
    { 1: 'saida', 2: 'entrada' },
  );

  assert.equal(orcamentos.length, 2, 'orçado zerado não entra');
  assert.equal(bucketBudgets(orcamentos, 'saida').vermelho.length, 1, '90% gasto = vermelho');
  assert.equal(bucketBudgets(orcamentos, 'entrada').verde.length, 1, '90% recebido = verde');
});

test('série BPO aceita o formato que a API realmente devolve (month/valor_orcado)', () => {
  const series = buildBpoCategorySeries(
    [{ categorias_id: 1, valor_orcado: 500, month: 9 }],
    [tx({ tipo: 'saida', valor: 200, status: 'pago', data: '2026-09-10', categoria: 1 })],
    2026,
    { 1: 'saida' },
    { 1: 'Aluguel' },
  );
  assert.equal(series.length, 1);
  assert.equal(series[0].totalBudgeted, 500);
  assert.equal(series[0].totalRealized, 200);
  assert.equal(series[0].budgeted[8], 500);
});

test('matriz BPO soma receitas, despesas e resultado', () => {
  const vm = buildBpoMatrixViewModel(
    [
      { id: 1, nome: 'Vendas', tipo: 'entrada' },
      { id: 2, nome: 'Aluguel', tipo: 'saida' },
    ],
    [
      { categorias_id: 1, month: 9, valor_orcado: 1000, valor_gasto: 0, valor_recebido: 800 },
      { categorias_id: 2, month: 9, valor_orcado: 300, valor_gasto: 250, valor_recebido: 0 },
    ],
    [],
    2026,
  );
  assert.equal(vm.receitas.length, 1);
  assert.equal(vm.despesas.length, 1);
  assert.equal(vm.resultado[8].realizado, 550);
  assert.equal(vm.resultado[8].orcado, 700);
});

test('conta padrão prefere "Meu Financeiro"', () => {
  const contas = [
    conta('a', 0, { nome: 'Nubank', criado_em: '2026-01-01T00:00:00Z' }),
    conta('b', 0, { nome: 'Meu Financeiro', criado_em: '2026-02-01T00:00:00Z' }),
  ];
  assert.equal(pickDefaultContaFinanceira(contas).id, 'b');
  assert.equal(pickDefaultContaFinanceira([]), null);
});

test('normalizeTransactionRow converte "saida" da API para "saída"', () => {
  const row = normalizeTransactionRow({ id: 9, tipo: 'saida', valor: '12.30', categoria: '4' });
  assert.equal(row.tipo, 'saída');
  assert.equal(row.valor, 12.3);
  assert.equal(row.categoria, 4);
  assert.equal(row.id, '9');
});
