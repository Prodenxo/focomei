import test from 'node:test';
import assert from 'node:assert/strict';

import {
  agregarLimiteMeiDasLinhas,
  anoCivilFromIsoCreatedAt,
  extrairValorLimiteMeiDaNota,
  extrairValorServicoTotalDoPayload,
  extrairValorTotalServicosDeObjeto,
  isDocumentTypeMeiLimiteRelevante,
  nfseDeveEntrarNoSomatorioLimite
} from '../src/utils/meiLimitePayloadSum.js';

test('extrairValorTotalServicosDeObjeto lê valorServico no root (PlugNotas periodo)', () => {
  assert.equal(
    extrairValorTotalServicosDeObjeto({
      tomador: '18189174000160',
      valorServico: 10.5,
      situacao: 'CONCLUIDO',
    }),
    10.5,
  );
});

test('agregarLimiteMeiDasLinhas: NFSE PlugNotas periodo com valorServico no root', () => {
  const rows = [
    {
      document_type: 'NFSE',
      status: 'CONCLUIDO',
      created_at: '2026-03-23T12:00:00.000Z',
      payload_json: null,
      response_json: {
        tomador: '18189174000160',
        valorServico: 10.5,
        dataAutorizacao: '2026-03-23T12:00:00.000Z',
      },
    },
  ];
  const r = agregarLimiteMeiDasLinhas(rows, 2026);
  assert.equal(r.total, 10.5);
  assert.equal(r.notasConsideradas, 1);
});

test('extrairValorServicoTotalDoPayload soma servico[].valor.servico', () => {
  const payload = {
    servico: [
      { valor: { servico: 1 }, codigo: '080201', discriminacao: 'Testes' }
    ],
    tomador: { cpfCnpj: '17422651000172' }
  };
  assert.equal(extrairValorServicoTotalDoPayload(payload), 1);
});

test('extrairValorTotalServicosDeObjeto prioriza valor.liquido', () => {
  assert.equal(
    extrairValorTotalServicosDeObjeto({
      servico: [{ valor: { liquido: 80, servico: 100 } }]
    }),
    80
  );
});

test('extrairValorLimiteMeiDaNota prefere response_json ao payload_json', () => {
  assert.equal(
    extrairValorLimiteMeiDaNota({
      response_json: { servico: [{ valor: { liquido: 50, servico: 1 } }] },
      payload_json: { servico: [{ valor: { servico: 999 } }] }
    }),
    50
  );
});

test('extrairValorLimiteMeiDaNota fallback payload se response servico vazio', () => {
  assert.equal(
    extrairValorLimiteMeiDaNota({
      response_json: { servico: [] },
      payload_json: { servico: [{ valor: { servico: 12 } }] }
    }),
    12
  );
});

test('agregarLimiteMeiDasLinhas: NFSE concluída só com response_json (liquido)', () => {
  const rows = [
    {
      document_type: 'NFSE',
      status: 'CONCLUIDO',
      created_at: '2026-03-23T12:00:00.000Z',
      payload_json: null,
      response_json: {
        servico: [{ valor: { liquido: 7, servico: 7 }, codigo: '080201' }]
      }
    }
  ];
  const r = agregarLimiteMeiDasLinhas(rows, 2026);
  assert.equal(r.total, 7);
  assert.equal(r.notasConsideradas, 1);
});

test('isDocumentTypeMeiLimiteRelevante: só NFSE', () => {
  assert.equal(isDocumentTypeMeiLimiteRelevante('NFSE'), true);
  assert.equal(isDocumentTypeMeiLimiteRelevante('NFE'), false);
  assert.equal(isDocumentTypeMeiLimiteRelevante('NFCE'), false);
  assert.equal(isDocumentTypeMeiLimiteRelevante(null), false);
});

test('agregarLimiteMeiDasLinhas: ignora NFE e NFCE mesmo com valor alto (FR-GUIA-FISC-17)', () => {
  const rows = [
    {
      document_type: 'NFSE',
      status: 'Concluída',
      created_at: '2026-06-01T10:00:00.000Z',
      payload_json: { servico: [{ valor: { servico: 100 } }] }
    },
    {
      document_type: 'NFE',
      status: 'concluido',
      created_at: '2026-06-02T10:00:00.000Z',
      payload_json: { servico: [{ valor: { servico: 50_000 } }] }
    },
    {
      document_type: 'NFCE',
      status: 'concluido',
      created_at: '2026-06-03T10:00:00.000Z',
      payload_json: { servico: [{ valor: { servico: 40_000 } }] }
    }
  ];
  const r = agregarLimiteMeiDasLinhas(rows, 2026);
  assert.equal(r.total, 100);
  assert.equal(r.notasConsideradas, 1);
});

test('agregarLimiteMeiDasLinhas: inclui NFSE arquivada (arquivar ≠ cancelar)', () => {
  const rows = [
    {
      document_type: 'NFSE',
      status: 'Concluída',
      created_at: '2026-03-01T12:00:00.000Z',
      archived_at: '2026-03-15T12:00:00.000Z',
      payload_json: { servico: [{ valor: { servico: 100 } }] }
    },
    {
      document_type: 'NFSE',
      status: 'Concluída',
      created_at: '2026-04-01T12:00:00.000Z',
      archived_at: null,
      payload_json: { servico: [{ valor: { servico: 50 } }] }
    }
  ];
  const r = agregarLimiteMeiDasLinhas(rows, 2026);
  assert.equal(r.total, 150);
  assert.equal(r.notasConsideradas, 2);
});

test('agregarLimiteMeiDasLinhas: só NFSE concluída no ano com payload_json', () => {
  const rows = [
    {
      document_type: 'NFSE',
      status: 'Concluída',
      created_at: '2026-02-01T10:00:00.000Z',
      payload_json: { servico: [{ valor: { servico: 10 } }] }
    },
    {
      document_type: 'NFSE',
      status: 'processando',
      created_at: '2026-02-01T10:00:00.000Z',
      payload_json: { servico: [{ valor: { servico: 999 } }] }
    },
    {
      document_type: 'NFSE',
      status: 'Concluída',
      created_at: '2025-02-01T10:00:00.000Z',
      payload_json: { servico: [{ valor: { servico: 50 } }] }
    }
  ];
  const r = agregarLimiteMeiDasLinhas(rows, 2026);
  assert.equal(r.total, 10);
  assert.equal(r.notasConsideradas, 1);
});

test('nfseDeveEntrarNoSomatorioLimite aceita Concluída e autorizada', () => {
  assert.equal(nfseDeveEntrarNoSomatorioLimite('CONCLUÍDA'), true);
  assert.equal(nfseDeveEntrarNoSomatorioLimite('Autorizada'), true);
  assert.equal(nfseDeveEntrarNoSomatorioLimite('processando'), false);
});

test('anoCivilFromIsoCreatedAt usa America/Sao_Paulo na virada', () => {
  assert.equal(anoCivilFromIsoCreatedAt('2026-01-01T02:00:00.000Z'), 2025);
  assert.equal(anoCivilFromIsoCreatedAt('2026-01-01T04:00:00.000Z'), 2026);
});

test('agregarLimiteMeiDasLinhas: ano civil por created_at em SP', () => {
  const rows = [
    {
      document_type: 'NFSE',
      status: 'Concluída',
      created_at: '2026-01-01T02:00:00.000Z',
      payload_json: { servico: [{ valor: { servico: 7 } }] }
    }
  ];
  const em2025 = agregarLimiteMeiDasLinhas(rows, 2025);
  assert.equal(em2025.total, 7);
  assert.equal(em2025.notasConsideradas, 1);
  const em2026 = agregarLimiteMeiDasLinhas(rows, 2026);
  assert.equal(em2026.total, 0);
  assert.equal(em2026.notasConsideradas, 0);
});

test('resolverDataAutorizacaoFiscalDaNota lê dataAutorizacao em retorno aninhado', async () => {
  const { resolverDataAutorizacaoFiscalDaNota } = await import('../src/utils/meiLimitePayloadSum.js');
  const iso = resolverDataAutorizacaoFiscalDaNota({
    response_json: {
      status: 'PROCESSANDO',
      retorno: { situacao: 'AUTORIZADA', dataAutorizacao: '2026-08-07T21:00:00.000Z' },
    },
  });
  assert.equal(iso, '2026-08-07T21:00:00.000Z');
});

test('resolverDataAutorizacaoFiscalDaNota ignora dataEmissao (competência)', async () => {
  const { resolverDataAutorizacaoFiscalDaNota, parseCreatedAtIsoFromIdIntegracao } = await import('../src/utils/meiLimitePayloadSum.js');
  const iso = resolverDataAutorizacaoFiscalDaNota({
    response_json: {
      dataEmissao: '2026-06-07T21:00:00.000Z',
    },
  });
  assert.equal(iso, null);
  const fromIntegracao = parseCreatedAtIsoFromIdIntegracao(
    'mei-4fbe702b-6c3c-4e07-a901-2a2aba3aa32f-1786038687223-1335a434',
  );
  assert.equal(fromIntegracao, '2026-08-06T17:51:27.223Z');
});
