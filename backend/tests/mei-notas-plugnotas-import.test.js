import test from 'node:test';
import assert from 'node:assert/strict';

import { mapPeriodoNotaToRow } from '../src/services/mei-notas-plugnotas-import.service.js';

test('histórico de NF-e entra na lista como NF-e, com cliente e valor', () => {
  const mapped = mapPeriodoNotaToRow({
    id: 'nfe-1',
    idIntegracao: 'mei-user-1',
    situacao: 'CONCLUIDO',
    destinatario: '12345678000199',
    nomeDestinatario: 'Cliente da NF-e',
    valorTotal: 150.5,
    serie: '2',
    numero: 18,
    emissao: '28/09/2026',
  }, {
    userId: 'user-1',
    cnpjPrestador: '66219910000178',
    documentType: 'NFE',
  });

  assert.equal(mapped.row.document_type, 'NFE');
  assert.equal(mapped.row.cnpj_tomador, '12345678000199');
  assert.equal(mapped.row.payload_json.destinatario.razaoSocial, 'Cliente da NF-e');
  assert.equal(mapped.row.payload_json.itens[0].valor, 150.5);
  assert.equal(mapped.row.payload_json.serie, '2');
  assert.equal(mapped.row.status, 'concluido');
});

test('histórico de NFS-e continua gravado como NFS-e', () => {
  const mapped = mapPeriodoNotaToRow({
    id: 'nfse-1',
    situacao: 'CONCLUIDO',
    tomador: '13794501799',
    nomeTomador: 'Rafael Reis',
    valorServico: 2,
    emissao: '28/09/2026',
  }, {
    userId: 'user-1',
    cnpjPrestador: '66219910000178',
  });

  assert.equal(mapped.row.document_type, 'NFSE');
  assert.equal(mapped.row.cnpj_tomador, '13794501799');
  assert.equal(mapped.row.payload_json.tomador.razaoSocial, 'Rafael Reis');
});
