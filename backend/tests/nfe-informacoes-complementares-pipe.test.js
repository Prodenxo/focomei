import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNfeInformacoesComplementares } from '../src/services/mei-notas.service.js';

test('Enter vira " | " (regra do emissor da NF-e)', () => {
  assert.equal(
    normalizeNfeInformacoesComplementares('Pedido 123\nEntrega em 5 dias\nObrigado'),
    'Pedido 123 | Entrega em 5 dias | Obrigado',
  );
});

test('quebra do Windows (\\r\\n) e linhas em branco também', () => {
  assert.equal(
    normalizeNfeInformacoesComplementares('Linha 1\r\n\r\n  Linha 2  \r\n'),
    'Linha 1 | Linha 2',
  );
});

test('texto sem Enter não muda; vazio fica vazio', () => {
  assert.equal(normalizeNfeInformacoesComplementares('Tudo numa linha só'), 'Tudo numa linha só');
  assert.equal(normalizeNfeInformacoesComplementares('   '), '');
  assert.equal(normalizeNfeInformacoesComplementares(null), '');
});
