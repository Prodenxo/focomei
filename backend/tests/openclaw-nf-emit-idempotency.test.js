import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOpenclawNfeEmitFingerprint,
  buildOpenclawNfseEmitFingerprint,
  stampOpenclawEmitMetadata,
} from '../src/services/openclaw-nf-emit-idempotency.js';

test('buildOpenclawNfseEmitFingerprint — tomador + valor + servicoIndice', () => {
  const fp = buildOpenclawNfseEmitFingerprint(
    { tomadorNome: 'Rafael Reis', valor: 1, servicoIndice: 1 },
    { tomadorRazaoSocial: 'Rafael Reis', servico: { valorServico: 1, codigo: '8219999' } },
  );
  assert.equal(fp, 'NFSE|rafael reis|1.00|8219999');
});

test('buildOpenclawNfeEmitFingerprint — destinatario + produto + valor', () => {
  const fp = buildOpenclawNfeEmitFingerprint(
    { destinatarioNome: 'Leonardo', produtoNome: 'Camisa branca', valor: 5 },
    {
      destinatario: { razaoSocial: 'Leonardo de Lima', cpfCnpj: '12345678901' },
      itens: [{ descricao: 'Camisa branca', valor: 5 }],
    },
  );
  assert.equal(fp, 'NFE|12345678901|5.00|camisa branca');
});

test('stampOpenclawEmitMetadata preserva source e grava fingerprint', () => {
  const meta = stampOpenclawEmitMetadata({ source: 'openclaw_whatsapp', foo: 1 }, 'NFSE|x|1.00|y');
  assert.equal(meta.source, 'openclaw_whatsapp');
  assert.equal(meta.foo, 1);
  assert.equal(meta.openclawEmitFingerprint, 'NFSE|x|1.00|y');
  assert.ok(meta.openclawEmitAt);
});
