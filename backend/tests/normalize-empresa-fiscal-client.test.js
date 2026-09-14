import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmpresaFiscalForClient } from '../src/services/mei-emitente-empresa-sync.js';

test('normalizeEmpresaFiscalForClient desembrulha GET PlugNotas e expõe NFe activa', () => {
  const raw = {
    message: 'OK',
    data: {
      cpfCnpj: '67593254000131',
      razaoSocial: 'DIVA BARBARA NEVES FERREIRA',
      nfse: { ativo: true },
      nfe: { ativo: true, tipoContrato: 0 },
      nfce: { ativo: false },
      endereco: {
        logradouro: 'Rua X',
        numero: '1',
        codigoCidade: '3304557',
        estado: 'RJ',
      },
    },
  };

  const flat = normalizeEmpresaFiscalForClient(raw);
  assert.ok(flat);
  assert.equal(flat.cpfCnpj, '67593254000131');
  assert.equal(flat.nfe?.ativo, true);
  assert.equal(flat.nfse?.ativo, true);
  assert.equal(flat.nfce?.ativo, false);
});
