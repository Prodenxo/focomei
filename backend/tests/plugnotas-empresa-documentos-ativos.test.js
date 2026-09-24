import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyEmpresaPlugnotasDocumentSelectionForPatch,
} from '../src/services/plugnotas/plugnotas-empresa-documentos-ativos.js';

test('monta NFC-e no contrato oficial e preserva CSC informado', () => {
  const payload = {
    nfce: {
      config: {
        producao: true,
        impressao: { versaoQrCode: 2 },
        sefaz: {
          idCodigoSegurancaContribuinte: '000001',
          codigoSegurancaContribuinte: 'segredo-csc',
        },
        numeracao: [{ serie: 2, numero: 10 }],
      },
    },
  };

  applyEmpresaPlugnotasDocumentSelectionForPatch(payload, {
    nfse: false,
    nfe: false,
    nfce: true,
  });

  assert.deepEqual(payload.nfce, {
    ativo: true,
    tipoContrato: 0,
    config: {
      producao: true,
      impressao: { versaoQrCode: 2 },
      sefaz: {
        idCodigoSegurancaContribuinte: '000001',
        codigoSegurancaContribuinte: 'segredo-csc',
      },
      numeracao: [{ serie: 2, numero: 10 }],
    },
  });
});
