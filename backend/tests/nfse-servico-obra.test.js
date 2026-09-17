import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertNfseServicoObraSuportado,
  formatNfseSubitem,
  nfseServicoExigeObra,
} from '../src/services/nfse-servico-obra.js';

test('reconhece subitem de obra com e sem máscara', () => {
  assert.equal(nfseServicoExigeObra('07.07.01'), true);
  assert.equal(nfseServicoExigeObra('070701'), true);
  assert.equal(nfseServicoExigeObra('14.14.04'), true);
});

test('serviço de limpeza de imóveis não é tratado como obra', () => {
  assert.equal(nfseServicoExigeObra('07.10.02'), false);
  assert.equal(nfseServicoExigeObra('080201'), false);
});

test('bloqueia a emissão antes de gastar número da nota', () => {
  const payload = {
    servico: [{ codigo: '07.07.01', discriminacao: 'Limpeza', valor: { servico: 1 } }],
  };
  assert.throws(
    () => assertNfseServicoObraSuportado(payload),
    (error) => error.status === 400
      && error.errors?.code === 'NFSE_SERVICO_EXIGE_OBRA'
      && error.errors?.codigo === '07.07.01',
  );
});

test('deixa passar quando os dados da obra vierem no payload', () => {
  const payload = {
    servico: [{ codigo: '07.07.01', obra: { codigo: '123' }, valor: { servico: 1 } }],
  };
  assert.doesNotThrow(() => assertNfseServicoObraSuportado(payload));
});

test('não interfere em serviços fora da lista de obra', () => {
  const payload = { servico: [{ codigo: '07.10.02', valor: { servico: 1 } }] };
  assert.doesNotThrow(() => assertNfseServicoObraSuportado(payload));
});

test('formata o subitem para leitura humana', () => {
  assert.equal(formatNfseSubitem('070701'), '07.07.01');
});
