import test from 'node:test';
import assert from 'node:assert/strict';

import {
  agregarLimiteMeiDasLinhas,
  isDocumentTypeMeiLimiteRelevante,
} from '../src/utils/meiLimitePayloadSum.js';

test('NFC-e autorizada entra no limite anual do MEI', () => {
  const result = agregarLimiteMeiDasLinhas([
    {
      document_type: 'NFCE',
      status: 'CONCLUIDO',
      created_at: '2026-09-23T12:00:00.000Z',
      payload_json: {
        itens: [{
          quantidade: { comercial: 2 },
          valorUnitario: { comercial: 25 },
        }],
      },
    },
  ], 2026);

  assert.equal(isDocumentTypeMeiLimiteRelevante('NFCE'), true);
  assert.deepEqual(result, { total: 50, notasConsideradas: 1 });
});
