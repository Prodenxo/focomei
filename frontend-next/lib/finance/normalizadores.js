import { normalizarValor } from './dashboardUtils.js';

/** Porte de `normalizeTransactionRow` (frontend/store/transactionStore.ts). */
export function normalizeTransactionRow(t) {
  return {
    ...t,
    id: String(t.id || ''),
    valor: typeof t.valor === 'string' ? parseFloat(t.valor) : Number(t.valor),
    tipo: String(t.tipo) === 'saida' ? 'saída' : String(t.tipo),
    classificacao: String(t.classificacao || ''),
    status: String(t.status || ''),
    user_id: t.user_id ? String(t.user_id) : null,
    criado_em: String(t.criado_em || ''),
    data: t.data ? String(t.data) : null,
    categoria:
      t.categoria !== null && t.categoria !== undefined
        ? typeof t.categoria === 'string'
          ? (Number.isNaN(Number(t.categoria)) ? t.categoria : Number(t.categoria))
          : t.categoria
        : null,
    obs: t.obs ? String(t.obs) : null,
    conta_id: t.conta_id ? String(t.conta_id) : null,
    recorrencia_id: t.recorrencia_id ? String(t.recorrencia_id) : null,
    recorrencia_ano_mes: t.recorrencia_ano_mes ? String(t.recorrencia_ano_mes) : null,
  };
}

/** Porte de `normalizeContaRow` (frontend/lib/contaFinanceiraTypes.ts). */
export function normalizeContaRow(row) {
  return {
    id: String(row.id ?? ''),
    user_id: String(row.user_id ?? ''),
    nome: String(row.nome ?? '').trim(),
    tipo: String(row.tipo ?? 'corrente'),
    saldo_inicial:
      typeof row.saldo_inicial === 'number'
        ? row.saldo_inicial
        : parseFloat(String(row.saldo_inicial ?? 0)) || 0,
    limite_credito:
      row.limite_credito == null
        ? null
        : typeof row.limite_credito === 'number'
          ? row.limite_credito
          : parseFloat(String(row.limite_credito)) || null,
    dia_fechamento: row.dia_fechamento == null ? null : Number(row.dia_fechamento),
    dia_vencimento: row.dia_vencimento == null ? null : Number(row.dia_vencimento),
    cor: row.cor ? String(row.cor) : null,
    instituicao_id: row.instituicao_id ? String(row.instituicao_id) : null,
    ativo: row.ativo !== false,
    of_provider: row.of_provider ? String(row.of_provider) : null,
    of_external_id: row.of_external_id ? String(row.of_external_id) : null,
    of_last_synced_at: row.of_last_synced_at ? String(row.of_last_synced_at) : null,
    criado_em: String(row.criado_em ?? ''),
    atualizado_em: String(row.atualizado_em ?? ''),
  };
}

/** Porte de `normalizeBudgetSummary` (frontend/lib/categoryService.ts). */
export function normalizeBudgetSummary(item) {
  const rawOrcado = item.valor_orcado;
  return {
    categorias_id: Number(item.categorias_id),
    valor_orcado:
      rawOrcado === null || rawOrcado === undefined ? null : normalizarValor(rawOrcado),
    valor_gasto: normalizarValor(item.valor_gasto),
    valor_recebido: normalizarValor(item.valor_recebido),
  };
}
