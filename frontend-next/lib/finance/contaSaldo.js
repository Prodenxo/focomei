import { normalizarTipo, normalizarValor } from './dashboardUtils.js';

/** Porte fiel de `frontend/lib/contaSaldo.ts`. */

export const REALIZED_LANCAMENTO_STATUS = new Set(['pago', 'recebido']);

const REALIZED_STATUS = REALIZED_LANCAMENTO_STATUS;

export function isRealizedLancamentoStatus(status) {
  return REALIZED_STATUS.has(String(status || '').toLowerCase());
}

/** Saldo atual = saldo inicial + entradas realizadas − saídas realizadas vinculadas à conta. */
export function computeContaSaldoAtual(saldoInicial, lancamentos, contaId) {
  let delta = 0;
  for (const tx of lancamentos) {
    if (!tx.conta_id || String(tx.conta_id) !== contaId) continue;
    if (!REALIZED_STATUS.has(String(tx.status || '').toLowerCase())) continue;
    const valor = normalizarValor(tx.valor);
    const tipo = normalizarTipo(tx.tipo);
    if (tipo === 'entrada') delta += valor;
    else delta -= valor;
  }
  return saldoInicial + delta;
}
