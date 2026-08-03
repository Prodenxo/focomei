import test from 'node:test';
import assert from 'node:assert/strict';
import {
  documentoFiscalLabel,
  extrairNomeClienteDaNota,
  extrairValorDaNota,
} from '../src/utils/notaFiscalDisplay.js';

test('extrairNomeClienteDaNota — NFSe via tomador', () => {
  const nome = extrairNomeClienteDaNota({
    document_type: 'NFSE',
    payload_json: {
      tomador: { razaoSocial: 'CF Contabilidade Ltda' },
    },
  });
  assert.equal(nome, 'CF Contabilidade Ltda');
});

test('extrairNomeClienteDaNota — NF-e via destinatario', () => {
  const nome = extrairNomeClienteDaNota({
    document_type: 'NFE',
    payload_json: {
      destinatario: { razaoSocial: 'Cliente Produto MEI' },
    },
  });
  assert.equal(nome, 'Cliente Produto MEI');
});

test('extrairValorDaNota — NFSe servico', () => {
  const valor = extrairValorDaNota({
    document_type: 'NFSE',
    payload_json: {
      servico: [{ valor: { servico: 150.5 } }],
    },
  });
  assert.equal(valor, 150.5);
});

test('extrairValorDaNota — NF-e itens e pagamentos', () => {
  const valor = extrairValorDaNota({
    document_type: 'NFE',
    payload_json: {
      itens: [{ valor: 80 }, { valor: 20 }],
      pagamentos: [{ valor: 100 }],
    },
  });
  assert.equal(valor, 100);
});

test('documentoFiscalLabel', () => {
  assert.equal(documentoFiscalLabel('NFE'), 'NF-e');
  assert.equal(documentoFiscalLabel('NFSE'), 'NFS-e');
});
