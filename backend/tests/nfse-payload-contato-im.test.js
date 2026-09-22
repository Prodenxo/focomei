import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayloadFromInput } from '../src/services/mei-notas.service.js';

const baseInput = {
  prestadorCpfCnpj: '12345678000199',
  prestadorRazaoSocial: 'Prestador MEI',
  prestadorEndereco: {
    logradouro: 'Rua A',
    numero: '10',
    bairro: 'Centro',
    cep: '01310100',
    codigoCidade: '3550308',
    descricaoCidade: 'São Paulo',
    estado: 'SP',
  },
  tomadorCpfCnpj: '98765432000188',
  tomadorRazaoSocial: 'Cliente LTDA',
  servico: {
    codigo: '140101',
    cnae: '9511800',
    discriminacao: 'Manutenção',
    valorServico: 100,
  },
};

test('inscrição municipal e telefone do prestador vão para o emissor', () => {
  const { payload } = buildPayloadFromInput({
    ...baseInput,
    prestadorInscricaoMunicipal: '123456/001',
    prestadorTelefone: '(41) 99999-8888',
  }, 'user-1');

  assert.equal(payload.prestador.inscricaoMunicipal, '123456/001');
  assert.deepEqual(payload.prestador.telefone, { ddd: '41', numero: '999998888' });
});

test('inscrição municipal e telefone do tomador vão para o emissor', () => {
  const { payload } = buildPayloadFromInput({
    ...baseInput,
    tomadorInscricaoMunicipal: '55.443/2',
    tomadorTelefone: '4133334444',
  }, 'user-1');

  assert.equal(payload.tomador.inscricaoMunicipal, '55.443/2');
  assert.deepEqual(payload.tomador.telefone, { ddd: '41', numero: '33334444' });
});

test('campos em branco não aparecem no payload — emissão atual não muda', () => {
  const { payload } = buildPayloadFromInput(baseInput, 'user-1');

  assert.equal('inscricaoMunicipal' in payload.prestador, false);
  assert.equal('telefone' in payload.prestador, false);
  assert.equal('inscricaoMunicipal' in payload.tomador, false);
  assert.equal('telefone' in payload.tomador, false);
});

test('telefone inválido é descartado em vez de quebrar a emissão', () => {
  const { payload } = buildPayloadFromInput({
    ...baseInput,
    prestadorTelefone: '1234',
    tomadorTelefone: 'sem numero',
  }, 'user-1');

  assert.equal('telefone' in payload.prestador, false);
  assert.equal('telefone' in payload.tomador, false);
});

test('telefone com +55 e objeto pronto são aceitos', () => {
  const comDdi = buildPayloadFromInput({
    ...baseInput,
    prestadorTelefone: '+55 (41) 99999-8888',
  }, 'user-1').payload;
  assert.deepEqual(comDdi.prestador.telefone, { ddd: '41', numero: '999998888' });

  const objeto = buildPayloadFromInput({
    ...baseInput,
    tomador: { telefone: { ddd: '11', numero: '988887777' } },
  }, 'user-1').payload;
  assert.deepEqual(objeto.tomador.telefone, { ddd: '11', numero: '988887777' });
});

test('NBS segue opcional: explícito vence, ausência cai na sugestão por LC 116', () => {
  const explicito = buildPayloadFromInput({
    ...baseInput,
    servico: { ...baseInput.servico, codigoNbs: '115011000' },
  }, 'user-1').payload;
  assert.equal(explicito.servico[0].codigoNbs, '115011000');

  const sugerido = buildPayloadFromInput(baseInput, 'user-1').payload;
  assert.equal(sugerido.servico[0].codigoNbs, '120013110');
});
