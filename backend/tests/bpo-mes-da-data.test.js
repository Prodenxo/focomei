import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMonthFromBudgetDate,
  parseMonthFromLancamentoDate,
} from '../src/services/categories.service.js';

/**
 * As colunas `lancamentos_id.data` e `orcamentos.date` são do tipo `date`.
 * O Supabase devolve texto, mas o node-pg devolve Date — e `String(Date)` vira
 * "Thu Sep 17 2026 …", que não casa com YYYY-MM-DD. Quando isso passou
 * despercebido, a matriz BPO ficou permanentemente vazia no modo local.
 */
test('mês vem certo tanto de texto quanto de Date do node-pg', () => {
  for (const parse of [parseMonthFromLancamentoDate, parseMonthFromBudgetDate]) {
    assert.equal(parse('2026-09-17'), 9);
    assert.equal(parse('2026-09-17T03:00:00.000Z'), 9);
    assert.equal(parse(new Date(2026, 8, 17)), 9);
    assert.equal(parse(new Date(2026, 0, 1)), 1);
    assert.equal(parse(new Date(2026, 11, 31)), 12);
  }
});

test('valor ausente ou inválido não vira mês', () => {
  for (const parse of [parseMonthFromLancamentoDate, parseMonthFromBudgetDate]) {
    assert.equal(parse(null), null);
    assert.equal(parse(''), null);
    assert.equal(parse('qualquer coisa'), null);
    assert.equal(parse(new Date('data inválida')), null);
  }
});
