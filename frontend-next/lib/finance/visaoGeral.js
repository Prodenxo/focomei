import {
  normalizarTipo,
  normalizarValor,
  normalizeCategoryKey,
  parsearData,
} from './dashboardUtils.js';
import { isRealizedLancamentoStatus } from './contaSaldo.js';

/**
 * Derivações que hoje vivem dentro de `frontend/screens/DashboardScreen.tsx`.
 * Extraídas sem mudar uma vírgula das contas.
 */

/** Entradas e saídas do mês — só status realizados. */
export function computeMonthRealizedFlow(monthTransactions) {
  const totalIncome = monthTransactions
    .filter((t) => normalizarTipo(t.tipo) === 'entrada' && isRealizedLancamentoStatus(t.status))
    .reduce((sum, t) => sum + normalizarValor(t.valor), 0);

  const totalExpenses = monthTransactions
    .filter((t) => normalizarTipo(t.tipo) === 'saida' && isRealizedLancamentoStatus(t.status))
    .reduce((sum, t) => sum + normalizarValor(t.valor), 0);

  return { totalIncome, totalExpenses };
}

function toDayKey(t) {
  const d = parsearData(t.data, t.criado_em);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Evolução do saldo no mês: um ponto por dia com movimentação realizada. */
export function buildSaldoSeries(monthTransactions) {
  const sortedByDate = [...monthTransactions].sort((a, b) => {
    const dateA = parsearData(a.data, a.criado_em);
    const dateB = parsearData(b.data, b.criado_em);
    return dateA.getTime() - dateB.getTime();
  });

  const daySaldoMap = new Map();
  let saldoAcumulado = 0;
  for (const t of sortedByDate) {
    if (!isRealizedLancamentoStatus(t.status)) continue;
    const valor = normalizarValor(t.valor);
    const tipoNormalizado = normalizarTipo(t.tipo);
    saldoAcumulado += tipoNormalizado === 'entrada' ? valor : -valor;
    daySaldoMap.set(toDayKey(t), saldoAcumulado);
  }

  const dayKeys = Array.from(daySaldoMap.keys()).sort();
  const saldoData = dayKeys.map((k) => daySaldoMap.get(k));
  return { dayKeys, saldoData };
}

function reduceByCategory(list) {
  return list.reduce((acc, curr) => {
    const valor =
      typeof curr.valor === 'number'
        ? curr.valor
        : typeof curr.valor === 'string'
          ? parseFloat(curr.valor) || 0
          : 0;
    let catKey = curr.categoria ? String(curr.categoria) : String(curr.classificacao || '');
    if (!catKey || catKey === 'NaN' || catKey === 'undefined' || catKey === 'null') {
      catKey = 'sem-categoria';
    }
    acc[catKey] = (acc[catKey] || 0) + valor;
    return acc;
  }, {});
}

/** Movimentações do mês separadas entre pagos e a pagar, agrupadas por categoria. */
export function buildDespesasPorCategoria(monthTransactions) {
  const despesasPeriodo = monthTransactions.filter((t) => normalizarTipo(t.tipo) === 'saida');
  const despesasPagos = despesasPeriodo.filter((t) => t.status === 'pago');
  const despesasAPagar = despesasPeriodo.filter((t) => t.status === 'a_pagar');

  const expensesByCategoryPagos = reduceByCategory(despesasPagos);
  const expensesByCategoryAPagar = reduceByCategory(despesasAPagar);
  const totalPagos = Object.values(expensesByCategoryPagos).reduce((s, v) => s + v, 0);
  const totalAPagar = Object.values(expensesByCategoryAPagar).reduce((s, v) => s + v, 0);

  return {
    expensesByCategoryPagos,
    expensesByCategoryAPagar,
    totalPagos,
    totalAPagar,
    countPagos: despesasPagos.length,
    countAPagar: despesasAPagar.length,
  };
}

export function buildCategorizedBudgets(budgetSummary, categoriasMap, categoriasTipoMap) {
  return budgetSummary
    .filter((item) => item.valor_orcado !== null && Number(item.valor_orcado) > 0)
    .map((item) => {
      const orcado = normalizarValor(item.valor_orcado);
      const gasto = normalizarValor(item.valor_gasto);
      const recebido = normalizarValor(item.valor_recebido);
      const tipo = categoriasTipoMap[String(item.categorias_id)] || 'saida';
      const realizado = tipo === 'entrada' ? recebido : gasto;
      const percentual = orcado > 0 ? (realizado / orcado) * 100 : 0;
      return {
        categorias_id: item.categorias_id,
        nome: categoriasMap[String(item.categorias_id)] || 'Sem categoria',
        tipo,
        orcado,
        realizado,
        percentual,
      };
    });
}

/** Faixas de farol do orçamento — invertidas entre entrada e saída, como hoje. */
export function bucketBudgets(categorizedBudgets, budgetTab) {
  const filtered = categorizedBudgets.filter((item) => item.tipo === budgetTab);
  if (budgetTab === 'entrada') {
    return {
      verde: filtered.filter((item) => item.percentual >= 75),
      amarelo: filtered.filter((item) => item.percentual > 50 && item.percentual < 75),
      laranja: filtered.filter((item) => item.percentual > 25 && item.percentual <= 50),
      vermelho: filtered.filter((item) => item.percentual <= 25),
    };
  }
  return {
    verde: filtered.filter((item) => item.percentual <= 25),
    amarelo: filtered.filter((item) => item.percentual > 25 && item.percentual <= 50),
    laranja: filtered.filter((item) => item.percentual > 50 && item.percentual <= 75),
    vermelho: filtered.filter((item) => item.percentual > 75),
  };
}

/**
 * Orçado x realizado por categoria no ano (gráficos da visão BPO).
 *
 * DIVERGÊNCIA CORRIGIDA: a tela antiga lê `row.valor_orçado` e `row.date`, mas a API
 * `/categories/budgets/yearly` devolve `valor_orcado` e `month` — por isso os gráficos
 * ficam sempre vazios lá. Aqui aceitamos as duas grafias. Ver `NOTAS-DIVERGENCIAS.md`.
 */
export function buildBpoCategorySeries(
  bpoBudgetRows,
  transactionsScoped,
  bpoYear,
  categoriasTipoMap,
  categoriasMap,
) {
  const budgetedByCategory = {};
  const realizedByCategory = {};
  const typeByCategory = {};

  const ensureCategory = (catId) => {
    if (!budgetedByCategory[catId]) budgetedByCategory[catId] = Array(12).fill(0);
    if (!realizedByCategory[catId]) realizedByCategory[catId] = Array(12).fill(0);
  };

  (bpoBudgetRows || []).forEach((row) => {
    const catId = String(row?.categorias_id || '');
    if (!catId) return;
    const tipo = categoriasTipoMap[catId] || 'saida';
    const valorBruto = row?.valor_orcado ?? row?.['valor_orçado'];
    const valor = typeof valorBruto === 'number' ? valorBruto : Number(valorBruto || 0);

    const monthIndex = row?.month != null
      ? Number(row.month) - 1
      : row?.date
        ? Number(String(row.date).split('-')[1]) - 1
        : -1;

    if (monthIndex >= 0 && monthIndex < 12) {
      ensureCategory(catId);
      budgetedByCategory[catId][monthIndex] += Number.isNaN(valor) ? 0 : valor;
      typeByCategory[catId] = tipo;
    }
  });

  const nameToId = {};
  Object.entries(categoriasMap).forEach(([id, nome]) => {
    if (nome) nameToId[normalizeCategoryKey(nome)] = id;
  });

  transactionsScoped.forEach((transaction) => {
    const date = parsearData(transaction.data, transaction.criado_em);
    if (date.getFullYear() !== bpoYear) return;
    const tipo = normalizarTipo(transaction.tipo);
    let catId = '';
    if (transaction.categoria && categoriasMap[String(transaction.categoria)]) {
      catId = String(transaction.categoria);
    } else {
      const key = normalizeCategoryKey(
        String(transaction.classificacao || transaction.categoria || ''),
      );
      catId = nameToId[key] || '';
    }
    if (!catId) catId = 'sem-categoria';
    ensureCategory(catId);
    realizedByCategory[catId][date.getMonth()] += normalizarValor(transaction.valor);
    if (!typeByCategory[catId]) typeByCategory[catId] = tipo;
  });

  const categoryIds = Array.from(
    new Set([...Object.keys(budgetedByCategory), ...Object.keys(realizedByCategory)]),
  );

  return categoryIds
    .map((catId) => {
      const budgeted = budgetedByCategory[catId] || Array(12).fill(0);
      const realized = realizedByCategory[catId] || Array(12).fill(0);
      const totalBudgeted = budgeted.reduce((sum, val) => sum + val, 0);
      const totalRealized = realized.reduce((sum, val) => sum + val, 0);
      return {
        id: catId,
        name: categoriasMap[catId] || (catId === 'sem-categoria' ? 'Sem categoria' : catId),
        type: typeByCategory[catId] || categoriasTipoMap[catId] || 'saida',
        budgeted,
        realized,
        totalBudgeted,
        totalRealized,
      };
    })
    .filter((item) => item.totalBudgeted > 0)
    .sort((a, b) => b.totalRealized - a.totalRealized);
}
