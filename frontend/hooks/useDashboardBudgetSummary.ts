import { useState, useEffect, useCallback } from 'react';
import {
  fetchCategoryBudgetsSummary,
  type CategoryBudgetSummary,
} from '../lib/categoryService';

export type BudgetSummaryItem = CategoryBudgetSummary;

export function useDashboardBudgetSummary(
  userId: string | null,
  _categoriasMap: Record<string, string>,
  selectedYearMonth: { year: number; month: number },
) {
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummaryItem[]>([]);

  const fetchBudgetSummary = useCallback(async () => {
    if (!userId) {
      setBudgetSummary([]);
      return;
    }
    try {
      const summary = await fetchCategoryBudgetsSummary(userId, selectedYearMonth);
      setBudgetSummary(summary);
    } catch {
      setBudgetSummary([]);
    }
  }, [userId, selectedYearMonth.year, selectedYearMonth.month]);

  useEffect(() => {
    fetchBudgetSummary();
  }, [fetchBudgetSummary]);

  return { budgetSummary, fetchCategoryBudgetsSummary: fetchBudgetSummary };
}
