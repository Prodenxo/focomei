import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmpresaFiscalForClient } from '../src/services/mei-emitente-empresa-sync.js';
import { sanitizePlugnotasEmpresaJsonForClientResponse } from '../src/services/plugnotas/prefeituraPortalCredentials.js';

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

test('expõe somente o estado seguro do CSC da NFC-e', () => {
  const flat = normalizeEmpresaFiscalForClient({
    data: {
      cpfCnpj: '67593254000131',
      nfce: {
        ativo: true,
        config: {
          sefaz: {
            idCodigoSegurancaContribuinte: '000001',
            codigoSegurancaContribuinte: 'segredo-csc',
          },
        },
      },
    },
  });

  assert.deepEqual(flat?.nfce, {
    ativo: true,
    cscConfigurado: true,
    cscId: '000001',
  });
});

test('remove código CSC de qualquer nível da resposta PlugNotas', () => {
  const sanitized = sanitizePlugnotasEmpresaJsonForClientResponse({
    data: {
      nfce: {
        config: {
          sefaz: {
            idCodigoSegurancaContribuinte: '000001',
            codigoSegurancaContribuinte: 'segredo-csc',
          },
        },
      },
      nfceCscCodigo: 'segredo-local',
    },
  });

  assert.equal(sanitized.data.nfce.config.sefaz.idCodigoSegurancaContribuinte, '000001');
  assert.equal('codigoSegurancaContribuinte' in sanitized.data.nfce.config.sefaz, false);
  assert.equal('nfceCscCodigo' in sanitized.data, false);
});
