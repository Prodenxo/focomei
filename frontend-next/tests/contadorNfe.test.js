import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyContadorSnapshotToCompanyForm,
  buildContadorLocalPatch,
  getDefaultPlugNotasCompanyForm,
  getPlugNotasCompanyValidationMessage,
  ufExigeAutorizadoNfe,
} from '../lib/plugNotasEmpresaForm.js';

const formValido = () => ({
  ...getDefaultPlugNotasCompanyForm(),
  razaoSocial: 'Loja',
  logradouro: 'Rua A',
  numero: '10',
  bairro: 'Centro',
  cep: '48909725',
  codigoCidade: '2918407',
  municipio: 'Juazeiro',
  uf: 'BA',
  email: 'loja@exemplo.com',
  nfeAtivo: true,
});

test('contador salvo no Foco MEI entra no formulário já marcado', () => {
  const form = applyContadorSnapshotToCompanyForm(getDefaultPlugNotasCompanyForm(), { contadorCnpj: '11222333000181' });
  assert.equal(form.usaContador, true);
  assert.equal(form.contadorCnpj, '11222333000181');

  const semContador = applyContadorSnapshotToCompanyForm(getDefaultPlugNotasCompanyForm(), { contadorCnpj: '' });
  assert.equal(semContador.usaContador, false);
});

test('escolher "não tenho contador" limpa o CNPJ ao salvar', () => {
  assert.deepEqual(buildContadorLocalPatch({ usaContador: false, contadorCnpj: '11222333000181' }), { contadorCnpj: '' });
  assert.deepEqual(buildContadorLocalPatch({ usaContador: true, contadorCnpj: '11.222.333/0001-81' }), { contadorCnpj: '11222333000181' });
});

test('contador marcado sem CNPJ completo bloqueia o salvar', () => {
  const invalido = { ...formValido(), usaContador: true, contadorCnpj: '1122' };
  assert.match(getPlugNotasCompanyValidationMessage(invalido), /CNPJ do contador/);
  const valido = { ...formValido(), usaContador: true, contadorCnpj: '11222333000181' };
  assert.equal(getPlugNotasCompanyValidationMessage(valido), null);
  const semContador = { ...formValido(), usaContador: false };
  assert.equal(getPlugNotasCompanyValidationMessage(semContador), null);
});

test('só a Bahia exige o grupo de autorizados por enquanto', () => {
  assert.equal(ufExigeAutorizadoNfe('BA'), true);
  assert.equal(ufExigeAutorizadoNfe('ba'), true);
  assert.equal(ufExigeAutorizadoNfe('RJ'), false);
});

test('fora da Bahia o CNPJ do contador não trava o salvar', () => {
  const rj = { ...formValido(), uf: 'RJ', usaContador: true, contadorCnpj: '' };
  assert.equal(getPlugNotasCompanyValidationMessage(rj), null);
});
