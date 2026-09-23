import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeMeiLimiteProgresso,
  somarNfseAutorizadasNoAnoCivil,
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

test('soma apenas NFS-e autorizadas do ano civil', () => {
  const notas = [
    nfse({ id: '1', status: 'CONCLUIDO', valor: 1000, createdAt: '2026-02-10T12:00:00Z' }),
    nfse({ id: '2', status: 'CONCLUIDO', valor: 500, createdAt: '2026-07-01T12:00:00Z' }),
    nfse({ id: '3', status: 'CONCLUIDO', valor: 900, createdAt: '2025-11-01T12:00:00Z' }),
  ];
  assert.deepEqual(
    somarNfseAutorizadasNoAnoCivil(notas, { anoCivil: 2026 }),
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
    somarNfseAutorizadasNoAnoCivil(notas, { anoCivil: 2026 }),
    { total: 1000, notasConsideradas: 1 },
  );
});

test('NF-e e NFC-e não entram no limite MEI', () => {
  const notas = [
    {
      id: 'nfe',
      status: 'CONCLUIDO',
      document_type: 'NFE',
      created_at: '2026-02-10T12:00:00Z',
      payload_json: { itens: [{ valor: 7000 }] },
    },
    nfse({ id: 'nfse', status: 'CONCLUIDO', valor: 1000, createdAt: '2026-02-10T12:00:00Z' }),
  ];
  assert.deepEqual(
    somarNfseAutorizadasNoAnoCivil(notas, { anoCivil: 2026 }),
    { total: 1000, notasConsideradas: 1 },
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
