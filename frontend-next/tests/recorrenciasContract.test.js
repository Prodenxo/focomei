import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecorrenciaPurgePayload } from '../lib/recorrenciaPurgeContract.js';

test('monta contrato atômico para excluir recorrência a partir de uma data', () => {
  assert.deepEqual(buildRecorrenciaPurgePayload('future', '2026-09-23T12:00:00Z'), {
    mode: 'future',
    from: '2026-09-23',
  });
});

test('monta contrato atômico para excluir toda a recorrência', () => {
  assert.deepEqual(buildRecorrenciaPurgePayload('all'), { mode: 'all' });
});

test('recusa modo ou data fora do contrato do backend', () => {
  assert.throws(() => buildRecorrenciaPurgePayload('one'), /Modo de exclusão/);
  assert.throws(() => buildRecorrenciaPurgePayload('future', ''), /Data inicial inválida/);
});
