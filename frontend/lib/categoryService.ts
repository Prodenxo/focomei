import { apiClient } from './apiClient';
import { normalizarValor } from './dashboardUtils';

const normalizeBudgetSummary = (item: CategoryBudgetSummary): CategoryBudgetSummary => {
  const rawOrcado = item.valor_orcado;
  return {
    categorias_id: Number(item.categorias_id),
    valor_orcado:
      rawOrcado === null || rawOrcado === undefined
        ? null
        : normalizarValor(rawOrcado),
    valor_gasto: normalizarValor(item.valor_gasto),
    valor_recebido: normalizarValor(item.valor_recebido),
  };
};

export type CategoryBudgetSummary = {
  categorias_id: number;
  valor_orcado: number | null;
  valor_gasto: number;
  valor_recebido: number;
};

export type DreMatrixCell = {
  categorias_id: number;
  month: number;
  valor_orcado: number | null;
  valor_gasto: number;
  valor_recebido: number;
};

export type UserCategory = {
  id: number;
  nome: string;
  tipo: string;
  user_id: string | null;
};

type CategoryBudgetMutationResult = {
  error: Error | null;
};

/** Lista categorias do utilizador (garante cópia das globais via API). */
export async function fetchUserCategories(_userId: string): Promise<UserCategory[]> {
  const data = await apiClient.get<UserCategory[]>('/categories');
  return data || [];
}

export async function fetchCategoryBudgetsSummary(
  _userId: string,
  monthParams: { year: number; month: number },
): Promise<CategoryBudgetSummary[]> {
  const { year, month } = monthParams;
  const data = await apiClient.get<CategoryBudgetSummary[]>(
    `/categories/budgets/summary?year=${year}&month=${month}`,
  );
  return (data || []).map(normalizeBudgetSummary);
}

export async function fetchCategoryBudgetsDreMatrix(
  _userId: string,
  year: number,
): Promise<DreMatrixCell[]> {
  const data = await apiClient.get<DreMatrixCell[]>(
    `/categories/budgets/dre-matrix?year=${year}`,
  );
  return data || [];
}

export async function fetchCategoryBudgetsYearly(_userId: string, year: number) {
  const data = await apiClient.get<
    Array<{ categorias_id: number; valor_orcado: number | null; month: number }>
  >(`/categories/budgets/yearly?year=${year}`);
  return data || [];
}

export async function saveCategoryBudget(
  _userId: string,
  categoriasId: number,
  valorOrcado: number | null,
  date: string,
): Promise<CategoryBudgetMutationResult> {
  try {
    await apiClient.post('/categories/budgets', {
      categorias_id: categoriasId,
      valor_orcado: valorOrcado,
      date,
    });
    return { error: null };
  } catch (error: unknown) {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/** Remove o planejamento do mês (`valor_orçado` → null); mantém a categoria e o realizado. */
export async function deleteCategoryBudget(
  userId: string,
  categoriasId: number,
  date: string,
): Promise<CategoryBudgetMutationResult> {
  return saveCategoryBudget(userId, categoriasId, null, date);
}

export async function duplicateMonthlyBudgets(
  _userId: string,
  year: number,
  month: number,
) {
  return apiClient.post('/categories/budgets/duplicate', { year, month });
}
