import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLancamentoObsFromNota,
  resolveLancamentoIdFromMetadata,
} from '../src/services/nota-lancamento-sync.service.js';

test('resolveLancamentoIdFromMetadata — lancamento_id snake_case', () => {
  assert.equal(
    resolveLancamentoIdFromMetadata({ lancamento_id: 'abc-123' }),
    'abc-123',
  );
});

test('resolveLancamentoIdFromMetadata — lancamentoId camelCase', () => {
  assert.equal(
    resolveLancamentoIdFromMetadata({ lancamentoId: 'xyz-456' }),
    'xyz-456',
  );
});

test('buildLancamentoObsFromNota — NFS-e com id_integracao', () => {
  const { obs, referencia } = buildLancamentoObsFromNota({
    document_type: 'NFSE',
    id_integracao: 'mei-user-123-abc',
    payload_json: {
      tomador: { razaoSocial: 'INSTITUTO ELO' },
    },
  });

  assert.equal(referencia, 'mei-user-123-abc');
  assert.equal(obs, 'NFS-e mei-user-123-abc — INSTITUTO ELO');
});

test('buildLancamentoObsFromNota — prioriza protocol sobre id_integracao', () => {
  const { obs, referencia } = buildLancamentoObsFromNota({
    document_type: 'NFSE',
    protocol: 'proto-99',
    id_integracao: 'mei-user-123-abc',
    payload_json: {
      tomador: { razaoSocial: 'Cliente MEI' },
    },
  });

  assert.equal(referencia, 'proto-99');
  assert.equal(obs, 'NFS-e proto-99 — Cliente MEI');
});
