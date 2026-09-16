import { apiClient } from '@/lib/api';
import {
  normalizeBudgetSummary,
  normalizeContaRow,
  normalizeTransactionRow,
} from '@/lib/finance/normalizadores';
import { normalizarTipo } from '@/lib/finance/dashboardUtils';

/** Mesmos endpoints e mesmas normalizações do app atual. */

export async function fetchTransacoes(signal) {
  const data = await apiClient.get('/transactions', { signal });
  return (data || []).map(normalizeTransactionRow);
}

export async function fetchContas(signal) {
  const data = await apiClient.get('/contas-financeiras?includeInactive=1', { signal });
  return (data?.contas || []).map(normalizeContaRow);
}

export async function fetchCategorias(signal) {
  const data = await apiClient.get('/categories', { signal });
  const categoriasMap = {};
  const categoriasTipoMap = {};
  const lista = [];

  (data || []).forEach((cat) => {
    const catId = String(cat.id ?? '');
    const nome = String(cat.nome ?? '');
    const tipo = normalizarTipo(String(cat.tipo ?? ''));
    categoriasMap[catId] = nome;
    categoriasTipoMap[catId] = tipo;
    if (Number(cat.id) > 0 && nome) {
      lista.push({ id: Number(cat.id), nome, tipo: String(cat.tipo || '') });
    }
  });

  return { categoriasMap, categoriasTipoMap, lista };
}

export async function fetchResumoOrcamentos({ year, month }, signal) {
  const data = await apiClient.get(
    `/categories/budgets/summary?year=${year}&month=${month}`,
    { signal },
  );
  return (data || []).map(normalizeBudgetSummary);
}

export async function fetchOrcamentosAnuais(year, signal) {
  const data = await apiClient.get(`/categories/budgets/yearly?year=${year}`, { signal });
  return data || [];
}

export async function fetchMatrizDre(year, signal) {
  const data = await apiClient.get(`/categories/budgets/dre-matrix?year=${year}`, { signal });
  return data || [];
}

/** Role, MEI e empresa atuais — a sessão do navegador pode estar defasada. */
export async function fetchSessaoApi(signal) {
  const data = await apiClient.get('/auth/session', { signal });
  if (!data?.session) throw new Error('Sessão inválida');
  return data.session;
}

export async function criarTransacao(payload) {
  return apiClient.post('/transactions', payload);
}
