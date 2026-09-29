import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldRegenerateDasBeforeSend } from '../src/services/mei-das-vencimento.js';

const depoisDoVencimento = new Date('2026-09-29T12:00:00.000Z');

test('WhatsApp envia a guia guardada mesmo vencida e não paga', () => {
  assert.equal(shouldRegenerateDasBeforeSend({
    competencia: '2026-08',
    paid: false,
    preferStored: true,
    hasStored: true,
    refDate: depoisDoVencimento,
  }), false);
});

test('sem guia guardada, a vencida ainda é buscada na Receita', () => {
  assert.equal(shouldRegenerateDasBeforeSend({
    competencia: '2026-08',
    paid: false,
    preferStored: true,
    hasStored: false,
    refDate: depoisDoVencimento,
  }), true);
});

test('pedido explícito de atualizar continua indo na Receita', () => {
  assert.equal(shouldRegenerateDasBeforeSend({
    competencia: '2026-08',
    paid: false,
    forceRefresh: true,
    preferStored: true,
    hasStored: true,
    refDate: depoisDoVencimento,
  }), true);
});
