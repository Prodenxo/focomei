import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCepIbgeToEndereco } from '../src/services/plugnotas/plugnotas-nfse-email-resolve.js';

const enderecoJuazeiroNoCepDeCandeias = {
  cep: '43815360',
  logradouro: 'AV TANCREDO NEVES',
  numero: 'S/N',
  bairro: 'CANDEIAS',
  codigoCidade: '2918407',
  descricaoCidade: 'CANDEIAS',
  estado: 'BA',
};

test('CEP de outra cidade troca o código IBGE gravado no cliente', () => {
  const next = applyCepIbgeToEndereco(enderecoJuazeiroNoCepDeCandeias, '2906501', 'Candeias', 'BA');
  assert.equal(next.codigoCidade, '2906501');
  assert.equal(next.descricaoCidade, 'Candeias');
  assert.equal(next.logradouro, 'AV TANCREDO NEVES');
});

test('código que já bate com o CEP permanece', () => {
  const next = applyCepIbgeToEndereco(
    { ...enderecoJuazeiroNoCepDeCandeias, codigoCidade: '2906501' },
    '2906501',
    'Candeias',
    'BA',
  );
  assert.equal(next.codigoCidade, '2906501');
  assert.equal(next.descricaoCidade, 'CANDEIAS');
});
