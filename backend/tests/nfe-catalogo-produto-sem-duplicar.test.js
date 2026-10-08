import test from 'node:test';
import assert from 'node:assert/strict';
import { findCatalogoProdutoNfeExistente } from '../src/services/mei-notas.service.js';

const manual = {
  id: 'manual-rot',
  codigo: 'ROT001',
  cnae: null,
  discriminacao: 'Roteador Wi-Fi',
  metadata_json: { ncm: '85176241', cfop: '5102' },
};

test('nota de produto reaproveita o produto cadastrado à mão pelo código', () => {
  const entry = { codigo: 'ROT001', cnae: '85176241', discriminacao: 'Roteador Wi-Fi' };
  assert.equal(findCatalogoProdutoNfeExistente([manual], entry)?.id, 'manual-rot');
});

test('descrição ou alíquota diferentes na nota não criam outro produto com o mesmo código', () => {
  const entry = { codigo: 'rot001', cnae: '85176241', discriminacao: 'Roteador Wi-Fi dual band' };
  assert.equal(findCatalogoProdutoNfeExistente([manual], entry)?.id, 'manual-rot');
});

test('mesmo código com NCM diferente é tratado como outro produto', () => {
  const entry = { codigo: 'ROT001', cnae: '84713012', discriminacao: 'Roteador Wi-Fi' };
  assert.equal(findCatalogoProdutoNfeExistente([manual], entry), null);
});

test('produto sem código casa pela descrição', () => {
  const semCodigo = { id: 'sem-cod', codigo: '', discriminacao: 'Cabo HDMI 2m', metadata_json: null };
  const entry = { codigo: '', cnae: '85444200', discriminacao: 'cabo hdmi 2m' };
  assert.equal(findCatalogoProdutoNfeExistente([semCodigo], entry)?.id, 'sem-cod');
});
