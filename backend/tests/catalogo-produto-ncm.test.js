import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeCatalogProdutoNcmCfop } from '../src/services/mei-notas.service.js';

test('NCM e CFOP enviados pela tela entram nos dados extras do produto', () => {
  const saved = mergeCatalogProdutoNcmCfop(
    { unidade: 'UN' },
    { ncm: '3924.1000', cfop: '5102' },
  );
  assert.deepEqual(saved, { unidade: 'UN', ncm: '39241000', cfop: '5102' });
});

test('NCM vazio some e o resto do produto permanece', () => {
  const saved = mergeCatalogProdutoNcmCfop(
    { unidade: 'UN', ncm: '39241000' },
    { ncm: '', cfop: '5102' },
  );
  assert.deepEqual(saved, { unidade: 'UN', cfop: '5102' });
});
