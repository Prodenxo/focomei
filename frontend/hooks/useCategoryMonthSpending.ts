import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import {
  fetchCategoryBudgetsSummary,
  type CategoryBudgetSummary,
} from '../lib/categoryService';
import { normalizarTipo, normalizeCategoryKey } from '../lib/dashboardUtils';

export type MonthRef = { year: number; month: number };

export type CategoryTransactionLine = {
  id: string;
  data: string;
  valor: number;
  tipo: string;
  classificacao: string;
  status: string;
  obs?: string | null;
};

export type CategorySpendingRow = {
  id: number;
  nome: string;
  tipo: 'entrada' | 'saida';
  amount: number;
  transactions: CategoryTransactionLine[];
};

type ApiTransactionRow = {
  id?: string | number;
  classificacao?: string;
  valor?: number | string;
  tipo?: string;
  data?: string | null;
  status?: string;
  obs?: string | null;
};

function getMonthRange({ year, month }: MonthRef) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    startOfMonth: start.toISOString().split('T')[0],
    endOfMonth: end.toISOString().split('T')[0],
  };
}

function mapTransactionRow(row: ApiTransactionRow): CategoryTransactionLine {
  return {
    id: String(row.id ?? ''),
    data: String(row.data ?? ''),
    valor: Number(row.valor ?? 0),
    tipo: String(row.tipo ?? ''),
    classificacao: String(row.classificacao ?? ''),
    status: String(row.status ?? ''),
    obs: row.obs != null ? String(row.obs) : null,
  };
}

export function useCategoryMonthSpending(
  userId: string | null,
  monthRef: MonthRef,
) {
  const [budgetSummary, setBudgetSummary] = useState<CategoryBudgetSummary[]>([]);
  const [monthTransactions, setMonthTransactions] = useState<CategoryTransactionLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setBudgetSummary([]);
      setMonthTransactions([]);
      setLoading(false);
      return;
    }

    const { startOfMonth, endOfMonth } = getMonthRange(monthRef);

    try {
      const [summary, allTransactions] = await Promise.all([
        fetchCategoryBudgetsSummary(userId, monthRef),
        apiClient.get<ApiTransactionRow[]>('/transactions'),
      ]);

      setBudgetSummary(summary);

      const filtered = (allTransactions || []).filter((row) => {
        const date = String(row.data ?? '').slice(0, 10);
        return date >= startOfMonth && date <= endOfMonth;
      });

      setMonthTransactions(filtered.map(mapTransactionRow));
    } catch {
      setBudgetSummary([]);
      setMonthTransactions([]);
    }
  }, [userId, monthRef.year, monthRef.month]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const summaryByCategoryId = budgetSummary.reduce<Record<number, CategoryBudgetSummary>>(
    (acc, item) => {
      acc[item.categorias_id] = item;
      return acc;
    },
    {},
  );

  function transactionsForCategory(nome: string, tipo: 'entrada' | 'saida') {
    const key = normalizeCategoryKey(nome);
    return monthTransactions.filter((tx) => {
      if (normalizarTipo(tx.tipo) !== tipo) return false;
      return normalizeCategoryKey(tx.classificacao) === key;
    });
  }

  function amountForCategory(
    catId: number,
    nome: string,
    tipo: 'entrada' | 'saida',
  ): number {
    const summary = summaryByCategoryId[catId];
    if (tipo === 'entrada') {
      if (summary && summary.valor_recebido > 0) return summary.valor_recebido;
    } else if (summary && summary.valor_gasto > 0) {
      return summary.valor_gasto;
    }
    return transactionsForCategory(nome, tipo).reduce((sum, tx) => sum + tx.valor, 0);
  }

  function buildRows(
    categorias: { id: number; nome: string; tipo: string }[],
    viewTipo: 'entrada' | 'saida',
  ): CategorySpendingRow[] {
    return categorias
      .filter((cat) => {
        const t = cat.tipo === 'entrada' ? 'entrada' : 'saida';
        return t === viewTipo;
      })
      .map((cat) => {
        const tipo = viewTipo;
        const transactions = transactionsForCategory(cat.nome, tipo);
        return {
          id: cat.id,
          nome: cat.nome,
          tipo,
          amount: amountForCategory(cat.id, cat.nome, tipo),
          transactions,
        };
      });
  }

  return {
    loading,
    refreshing,
    refresh,
    budgetSummary,
    monthTransactions,
    buildRows,
  };
}

export function formatMonthLabel({ year, month }: MonthRef): string {
  const date = new Date(year, month - 1, 1);
  const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
  const cap = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${cap} De ${year}`;
}

export function shiftMonth(ref: MonthRef, delta: number): MonthRef {
  const d = new Date(ref.year, ref.month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
