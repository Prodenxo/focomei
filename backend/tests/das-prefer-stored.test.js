import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canFallbackToStoredDas,
  shouldRegenerateDasBeforeSend,
} from '../src/services/mei-das-vencimento.js';

const depoisDoVencimento = new Date('2026-09-29T12:00:00.000Z');
const antesDoVencimento = new Date('2026-09-10T12:00:00.000Z');

test('guia vencida e não paga continua sendo buscada na Receita para atualizar vencimento e valor', () => {
  assert.equal(shouldRegenerateDasBeforeSend({
    competencia: '2026-08',
    paid: false,
    refDate: depoisDoVencimento,
  }), true);
});

test('guia dentro do prazo ou já paga não precisa ir na Receita', () => {
  assert.equal(shouldRegenerateDasBeforeSend({
    competencia: '2026-08',
    paid: false,
    refDate: antesDoVencimento,
  }), false);
  assert.equal(shouldRegenerateDasBeforeSend({
    competencia: '2026-08',
    paid: true,
    refDate: depoisDoVencimento,
  }), false);
});

test('com a Receita fora do ar, a guia guardada vai como reserva', () => {
  assert.equal(canFallbackToStoredDas({ serproUnavailable: true, hasStored: true }), true);
});

test('sem guia guardada ou com outro tipo de erro, a falha segue para o cliente', () => {
  assert.equal(canFallbackToStoredDas({ serproUnavailable: true, hasStored: false }), false);
  assert.equal(canFallbackToStoredDas({ serproUnavailable: false, hasStored: true }), false);
});
