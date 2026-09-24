import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeMeiLimiteProgresso,
  parseDataBrIso,
  resolverDataEmissaoDaNota,
  somarNotasAutorizadasNoAnoCivil,
} from '../lib/meiLimiteFaturamento.js';
import { getLimiteReferenciaReaisParaAno } from '../lib/meiLimiteFaturamentoConfig.js';

function nfse({ id, status, valor, createdAt }) {
  return {
    id,
    status,
    document_type: 'NFSE',
    created_at: createdAt,
    payload_json: { servico: [{ valor: { servico: valor } }] },
  };
}

function nfe({ id, status, valor, createdAt, documentType = 'NFE' }) {
  return {
    id,
    status,
    document_type: documentType,
    created_at: createdAt,
    payload_json: {
      itens: [{
        valor,
        quantidade: { comercial: 1 },
        valorUnitario: { comercial: valor },
      }],
    },
  };
}

test('soma apenas notas autorizadas do ano civil', () => {
  const notas = [
    nfse({ id: '1', status: 'CONCLUIDO', valor: 1000, createdAt: '2026-02-10T12:00:00Z' }),
    nfse({ id: '2', status: 'CONCLUIDO', valor: 500, createdAt: '2026-07-01T12:00:00Z' }),
    nfse({ id: '3', status: 'CONCLUIDO', valor: 900, createdAt: '2025-11-01T12:00:00Z' }),
  ];
  assert.deepEqual(
    somarNotasAutorizadasNoAnoCivil(notas, { anoCivil: 2026 }),
    { total: 1500, notasConsideradas: 2 },
  );
});

test('nota cancelada, rejeitada ou em cancelamento sai do somatório', () => {
  const notas = [
    nfse({ id: '1', status: 'CONCLUIDO', valor: 1000, createdAt: '2026-02-10T12:00:00Z' }),
    nfse({ id: '2', status: 'CANCELADO', valor: 2000, createdAt: '2026-03-10T12:00:00Z' }),
    nfse({ id: '3', status: 'CANCELAMENTO_PENDENTE', valor: 3000, createdAt: '2026-04-10T12:00:00Z' }),
    nfse({ id: '4', status: 'REJEITADO', valor: 4000, createdAt: '2026-05-10T12:00:00Z' }),
    nfse({ id: '5', status: 'PROCESSANDO', valor: 5000, createdAt: '2026-06-10T12:00:00Z' }),
  ];
  assert.deepEqual(
    somarNotasAutorizadasNoAnoCivil(notas, { anoCivil: 2026 }),
    { total: 1000, notasConsideradas: 1 },
  );
});

test('NFS-e, NF-e e NFC-e autorizadas entram no limite', () => {
  const notas = [
    nfse({ id: 'nfse', status: 'CONCLUIDO', valor: 1000, createdAt: '2026-02-10T12:00:00Z' }),
    nfe({ id: 'nfe', status: 'CONCLUIDO', valor: 700, createdAt: '2026-02-10T12:00:00Z' }),
    nfe({
      id: 'nfce',
      status: 'CONCLUIDO',
      valor: 5000,
      createdAt: '2026-02-10T12:00:00Z',
      documentType: 'NFCE',
    }),
  ];
  assert.deepEqual(
    somarNotasAutorizadasNoAnoCivil(notas, { anoCivil: 2026 }),
    { total: 6700, notasConsideradas: 3 },
  );
});

test('NF-e usa o valor autorizado do retorno quando existe', () => {
  const nota = {
    id: 'nfe',
    status: 'CONCLUIDO',
    document_type: 'NFE',
    created_at: '2026-02-10T12:00:00Z',
    payload_json: { itens: [{ valor: 10 }] },
    response_json: { valor: 12, dataAutorizacao: '2026-02-10T12:00:00Z' },
  };
  assert.deepEqual(
    somarNotasAutorizadasNoAnoCivil([nota], { anoCivil: 2026 }),
    { total: 12, notasConsideradas: 1 },
  );
});

test('NF-e cancelada sai do somatório', () => {
  const notas = [
    nfe({ id: '1', status: 'CONCLUIDO', valor: 700, createdAt: '2026-02-10T12:00:00Z' }),
    nfe({ id: '2', status: 'CANCELADO', valor: 900, createdAt: '2026-03-10T12:00:00Z' }),
  ];
  assert.deepEqual(
    somarNotasAutorizadasNoAnoCivil(notas, { anoCivil: 2026 }),
    { total: 700, notasConsideradas: 1 },
  );
});

test('usa o limite MEI do ano e calcula o percentual', () => {
  const progresso = computeMeiLimiteProgresso(
    [nfse({ id: '1', status: 'CONCLUIDO', valor: 8100, createdAt: '2026-02-10T12:00:00Z' })],
    { anoCivil: 2026 },
  );
  assert.equal(progresso.limiteReferenciaReais, 81_000);
  assert.equal(getLimiteReferenciaReaisParaAno(2026), 81_000);
  assert.equal(progresso.totalUtilizadoReais, 8100);
  assert.equal(progresso.percentualUtilizado, 10);
  assert.equal(progresso.banda, 'seguro');
});

test('zera o agregado do servidor quando não resta nota autorizada na lista', () => {
  const progresso = computeMeiLimiteProgresso(
    [nfse({ id: '1', status: 'CANCELADO', valor: 2000, createdAt: '2026-02-10T12:00:00Z' })],
    {
      anoCivil: 2026,
      agregadoServidor: { totalUtilizadoReais: 2000, notasConsideradas: 1 },
    },
  );
  assert.equal(progresso.totalUtilizadoReais, 0);
  assert.equal(progresso.notasConsideradas, 0);
});

test('cai para a soma local quando o servidor ainda não contabilizou a nota', () => {
  const progresso = computeMeiLimiteProgresso(
    [nfse({ id: '1', status: 'CONCLUIDO', valor: 1200, createdAt: '2026-02-10T12:00:00Z' })],
    {
      anoCivil: 2026,
      agregadoServidor: { totalUtilizadoReais: 0, notasConsideradas: 0 },
    },
  );
  assert.equal(progresso.totalUtilizadoReais, 1200);
  assert.equal(progresso.notasConsideradas, 1);
});

test('data da PlugNotas e lida como dia/mes/ano', () => {
  assert.equal(parseDataBrIso('11/08/2026'), '2026-08-11T03:00:00.000Z');
  assert.equal(parseDataBrIso('25/08/2026 14:30:00'), '2026-08-25T17:30:00.000Z');
  assert.equal(parseDataBrIso('2026-08-11T12:00:00Z'), null);
  assert.equal(parseDataBrIso('13/13/2026'), null);
});

test('emissao usa a data de autorizacao sem trocar dia por mes', () => {
  const nota = {
    status: 'CONCLUIDO',
    document_type: 'NFE',
    created_at: '2026-11-08T00:00:00.000Z',
    response_json: { dataAutorizacao: '11/08/2026' },
  };
  assert.equal(resolverDataEmissaoDaNota(nota), '2026-08-11T03:00:00.000Z');
});
