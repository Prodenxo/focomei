import test from 'node:test';
import assert from 'node:assert/strict';

import { sortNotasPorListaRecencia } from '../src/utils/meiLimitePayloadSum.js';

const hoje = (hora) => `2026-09-28T${hora}:00.000Z`;

test('nota emitida agora fica no topo mesmo com autorização só com a data', () => {
  const rows = [
    {
      id: 'nfse-manha',
      status: 'concluido',
      created_at: hoje('12:30'),
      id_integracao: `mei-u-${Date.parse(hoje('12:30'))}-aaaa`,
      response_json: [{ situacao: 'CONCLUIDO', autorizacao: '28/09/2026' }],
    },
    {
      id: 'nfe-agora',
      status: 'concluido',
      created_at: '2026-09-28T03:00:00.000Z',
      id_integracao: `mei-u-${Date.parse(hoje('15:05'))}-bbbb`,
      response_json: [{ situacao: 'CONCLUIDO', autorizacao: '28/09/2026' }],
    },
    {
      id: 'nfse-julho',
      status: 'concluido',
      created_at: '2026-07-09T03:00:00.000Z',
      response_json: [{ situacao: 'CONCLUIDO', autorizacao: '09/07/2026' }],
    },
  ];

  assert.deepEqual(
    sortNotasPorListaRecencia(rows).map((r) => r.id),
    ['nfe-agora', 'nfse-manha', 'nfse-julho'],
  );
});
