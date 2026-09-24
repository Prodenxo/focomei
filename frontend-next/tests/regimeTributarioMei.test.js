import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLUGNOTAS_REGIME_TRIBUTARIO_MEI,
  PLUGNOTAS_REGIME_TRIBUTARIO_MEI_LABEL,
  PLUGNOTAS_REGIME_TRIBUTARIO_OPTIONS,
  getDefaultPlugNotasCompanyForm,
} from '../lib/plugNotasEmpresaForm.js';

test('a plataforma é só MEI: o regime não é uma escolha', () => {
  assert.equal(PLUGNOTAS_REGIME_TRIBUTARIO_OPTIONS.length, 1);
  assert.equal(PLUGNOTAS_REGIME_TRIBUTARIO_OPTIONS[0].label, PLUGNOTAS_REGIME_TRIBUTARIO_MEI_LABEL);
  assert.match(PLUGNOTAS_REGIME_TRIBUTARIO_MEI_LABEL, /MEI/);
});

/**
 * Regressão fiscal: na PlugNotas o MEI é regime 1 + regime especial 5. Mandar 4 daqui
 * faz o XML sair com CRT 3 e a SEFAZ rejeita com a 481.
 */
test('o regime enviado à PlugNotas continua sendo 1', () => {
  assert.equal(PLUGNOTAS_REGIME_TRIBUTARIO_MEI, '1');
  assert.equal(PLUGNOTAS_REGIME_TRIBUTARIO_OPTIONS[0].value, '1');
  assert.equal(getDefaultPlugNotasCompanyForm().regimeTributario, '1');
});
