import test from 'node:test';
import assert from 'node:assert/strict';

import {
  catalogProdutoValorSugerido,
  catalogProdutoValorSugeridoInput,
} from '../lib/catalogProdutoDisplay.js';

test('valor sugerido aceita número ou texto vindo da API', () => {
  assert.equal(catalogProdutoValorSugerido(150), 150);
  assert.equal(catalogProdutoValorSugerido('150.00'), 150);
  assert.equal(catalogProdutoValorSugerido('99,90'), 99.9);
  assert.equal(catalogProdutoValorSugerido(null), null);
  assert.equal(catalogProdutoValorSugerido(''), null);
});

test('valor sugerido em texto vira campo de dinheiro sem quebrar a tela', () => {
  assert.equal(catalogProdutoValorSugeridoInput('150.00'), '150,00');
  assert.equal(catalogProdutoValorSugeridoInput(0.01), '0,01');
  assert.equal(catalogProdutoValorSugeridoInput(1234.5), '1234,50');
  assert.equal(catalogProdutoValorSugeridoInput(null), '');
  assert.equal(catalogProdutoValorSugeridoInput('0'), '');
  assert.equal(catalogProdutoValorSugeridoInput('abc'), '');
});
