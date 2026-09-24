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

test('informações complementares digitadas vão para o emissor', () => {
  const { payload } = buildPayloadFromInput({
    ...baseInput,
    informacoesComplementares: 'Inscrição municipal 123456 informada manualmente.',
  }, 'user-1');

  assert.equal(
    payload.informacoesComplementares,
    'Inscrição municipal 123456 informada manualmente.',
  );
});

test('campo em branco não aparece no payload — emissão atual não muda', () => {
  const { payload } = buildPayloadFromInput(baseInput, 'user-1');
  assert.equal('informacoesComplementares' in payload, false);

  const vazio = buildPayloadFromInput({
    ...baseInput,
    informacoesComplementares: '',
  }, 'user-1').payload;
  assert.equal('informacoesComplementares' in vazio, false);
});
