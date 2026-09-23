import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCnaeImportPayload,
  getE0014AutoArchiveIds,
  isE0014RejectedRecord,
  normalizeCnaeOptions,
} from '../lib/fiscalPhase4.js';
import { recalculateNfeItemsTax } from '../lib/recalculateNfeItemsTax.js';

test('detecta E0014 rejeitada e evita novo autoarquivamento', () => {
  const record = {
    id: 'nota-1',
    status: 'REJEITADO',
    response_json: [{ retorno: { mensagemRetorno: 'E0014: RPS já informado.' } }],
  };
  assert.equal(isE0014RejectedRecord(record), true);
  assert.deepEqual(getE0014AutoArchiveIds([record]), ['nota-1']);
  assert.deepEqual(getE0014AutoArchiveIds([record], new Set(['nota-1'])), []);
  assert.equal(isE0014RejectedRecord({ ...record, status: 'CONCLUIDO' }), false);
});

test('normaliza CNAEs e monta importação com LC 116 escolhida', () => {
  const cnaes = normalizeCnaeOptions({
    cnaePrincipal: { codigo: '6201-5/01', descricao: 'Desenvolvimento' },
    cnaesSecundarios: [
      { codigo: '6201501', descricao: 'Duplicado' },
      { codigo: '6311900', descricao: 'Dados' },
    ],
  });
  assert.deepEqual(cnaes, [
    { codigo: '6201501', descricao: 'Desenvolvimento', principal: true },
    { codigo: '6311900', descricao: 'Dados', principal: false },
  ]);
  assert.deepEqual(
    buildCnaeImportPayload(cnaes, new Set(['6201501']), {
      6201501: { codigo: '01.01', descricao: 'Análise de sistemas' },
    }),
    {
      documentType: 'NFSE',
      items: [{
        codigo: '6201501',
        descricao: 'Desenvolvimento',
        principal: true,
        codigoServico: '01.01',
      }],
    },
  );
});

test('não inventa tributação quando não há endpoint backend', async () => {
  const items = [{
    codigo: 'A1',
    ncm: '12345678',
    cfop: '5102',
    tributos: { icms: { csosn: '102' } },
  }];
  const result = await recalculateNfeItemsTax(items, 'SP', 'RJ');
  assert.deepEqual(result, items);
  assert.equal(result, items);
});
