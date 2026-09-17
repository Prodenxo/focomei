import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyNfseObraFromTomadorEndereco,
  assertNfseServicoObraSuportado,
  buildCidadePrestacaoFromEndereco,
  formatNfseSubitem,
  nfseServicoExigeObra,
} from '../src/services/nfse-servico-obra.js';

const enderecoCliente = {
  logradouro: 'R DOUTOR ANTONIO CARLOS TINOCO',
  numero: '780',
  bairro: 'JARDIM ANHANGUERA',
  cep: '14092210',
  codigoCidade: '3543402',
  descricaoCidade: 'RIBEIRAO PRETO',
  estado: 'SP',
};

test('reconhece subitem de obra com e sem máscara', () => {
  assert.equal(nfseServicoExigeObra('07.07.01'), true);
  assert.equal(nfseServicoExigeObra('070701'), true);
  assert.equal(nfseServicoExigeObra('14.14.04'), true);
});

test('serviço de limpeza de imóveis não é tratado como obra', () => {
  assert.equal(nfseServicoExigeObra('07.10.02'), false);
  assert.equal(nfseServicoExigeObra('080201'), false);
});

test('bloqueia a emissão se não houver endereço da obra', () => {
  const payload = {
    servico: [{ codigo: '07.07.01', discriminacao: 'Limpeza', valor: { servico: 1 } }],
  };
  assert.throws(
    () => assertNfseServicoObraSuportado(payload),
    (error) => error.status === 400
      && error.errors?.code === 'NFSE_SERVICO_EXIGE_OBRA'
      && error.errors?.codigo === '07.07.01',
  );
});

test('usa o endereço do cliente como local da obra', () => {
  const payload = applyNfseObraFromTomadorEndereco({
    tomador: { endereco: enderecoCliente },
    servico: [{ codigo: '07.07.01', valor: { servico: 1 } }],
  });
  assert.equal(payload.cidadePrestacao.codigo, '3543402');
  assert.equal(payload.cidadePrestacao.logradouro, enderecoCliente.logradouro);
  assert.equal(payload.cidadePrestacao.numero, '780');
  assert.equal(payload.cidadePrestacao.cep, '14092210');
  assert.equal(payload.servico[0].obra.endereco.codigoCidade, '3543402');
  assert.doesNotThrow(() => assertNfseServicoObraSuportado(payload));
});

test('não sobrescreve um local da obra já informado', () => {
  const payload = applyNfseObraFromTomadorEndereco({
    tomador: { endereco: enderecoCliente },
    cidadePrestacao: {
      codigo: '3550308',
      logradouro: 'Av Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      estado: 'SP',
      cep: '01310100',
    },
    servico: [{ codigo: '07.07.01', valor: { servico: 1 } }],
  });
  assert.equal(payload.cidadePrestacao.logradouro, 'Av Paulista');
});

test('não interfere em serviços fora da lista de obra', () => {
  const payload = applyNfseObraFromTomadorEndereco({
    tomador: { endereco: enderecoCliente },
    servico: [{ codigo: '07.10.02', valor: { servico: 1 } }],
  });
  assert.equal(payload.cidadePrestacao, undefined);
  assert.doesNotThrow(() => assertNfseServicoObraSuportado(payload));
});

test('monta cidadePrestacao só com endereço completo', () => {
  assert.equal(buildCidadePrestacaoFromEndereco({ logradouro: 'Rua A' }), null);
  assert.equal(buildCidadePrestacaoFromEndereco(enderecoCliente)?.codigo, '3543402');
});

test('formata o subitem para leitura humana', () => {
  assert.equal(formatNfseSubitem('070701'), '07.07.01');
});
