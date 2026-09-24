import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMPRESA_ONBOARDING_SELECT,
  isValidEmpresaCnpj,
} from '../src/services/empresa-cnpj-onboarding.service.js';

test('a leitura da empresa traz o id, senão o gate acusa "Empresa não encontrada"', () => {
  const colunas = EMPRESA_ONBOARDING_SELECT.split(',').map((c) => c.trim());
  assert.ok(colunas.includes('id'));
  assert.ok(colunas.includes('cnpj'));
});

test('CNPJ do escritório só precisa ter 14 dígitos para liberar o cadastro', () => {
  assert.equal(isValidEmpresaCnpj('11222333000181'), true);
  assert.equal(isValidEmpresaCnpj('11.222.333/0001-81'), true);
  assert.equal(isValidEmpresaCnpj('00000000000000'), true);
  assert.equal(isValidEmpresaCnpj('123'), false);
  assert.equal(isValidEmpresaCnpj(null), false);
});
