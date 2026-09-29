import test from 'node:test';
import assert from 'node:assert/strict';

import {
  catalogProdutoCfopInput,
  catalogProdutoNcmInput,
  catalogProdutoNfeMetadata,
  catalogProdutoSubtitle,
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

test('NCM e CFOP do produto voltam do que foi gravado nos dados extras', () => {
  const item = { codigo: '010101', metadata_json: { ncm: '39241000', cfop: '5102', unidade: 'UN' } };
  assert.equal(catalogProdutoNcmInput(item), '39241000');
  assert.equal(catalogProdutoCfopInput(item), '5102');
  assert.equal(catalogProdutoSubtitle(item), 'Cód. 010101 · NCM 39241000');
});

test('salvar produto guarda o NCM sem apagar os outros dados', () => {
  const saved = catalogProdutoNfeMetadata(
    { unidade: 'UN', icmsCsosn: '102' },
    { ncm: '3924.1000', cfop: '5102' },
  );
  assert.deepEqual(saved, { unidade: 'UN', icmsCsosn: '102', ncm: '39241000', cfop: '5102' });
});
