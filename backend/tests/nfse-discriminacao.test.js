import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyNfseDiscriminacaoLineBreaks,
  sanitizeNfseDiscriminacao,
} from '../src/services/nfse-discriminacao.js';

test('quebra de linha digitada vira o separador aceito pelo emissor', () => {
  assert.equal(
    sanitizeNfseDiscriminacao('Fabricação de cinco portas\nInstalação no local'),
    'Fabricação de cinco portas|Instalação no local',
  );
  assert.equal(
    sanitizeNfseDiscriminacao('Serviço A\r\nServiço B'),
    'Serviço A|Serviço B',
  );
});

test('linha em branco e pipe repetido não geram separador duplicado', () => {
  assert.equal(sanitizeNfseDiscriminacao('Item 1\n\n\nItem 2'), 'Item 1|Item 2');
  assert.equal(sanitizeNfseDiscriminacao('Item 1 |\nItem 2'), 'Item 1 |Item 2');
});

test('espaços em volta da quebra e separador nas pontas são removidos', () => {
  assert.equal(sanitizeNfseDiscriminacao('  Item 1   \n   Item 2  '), 'Item 1|Item 2');
  assert.equal(sanitizeNfseDiscriminacao('\nItem único\n'), 'Item único');
});

test('texto sem quebra de linha continua igual', () => {
  assert.equal(sanitizeNfseDiscriminacao('Manutenção de portas'), 'Manutenção de portas');
  assert.equal(sanitizeNfseDiscriminacao('Etapa 1 | Etapa 2'), 'Etapa 1 | Etapa 2');
});

test('valor vazio ou ausente devolve null', () => {
  assert.equal(sanitizeNfseDiscriminacao(''), null);
  assert.equal(sanitizeNfseDiscriminacao('   \n  '), null);
  assert.equal(sanitizeNfseDiscriminacao(null), null);
  assert.equal(sanitizeNfseDiscriminacao(undefined), null);
});

test('payload da NFS-e sai com todas as discriminações normalizadas', () => {
  const payload = {
    servico: [
      { codigo: '141302', discriminacao: 'Portas\nInstalação' },
      { codigo: '171901', discriminacao: 'Consultoria' },
    ],
  };

  const result = applyNfseDiscriminacaoLineBreaks(payload);

  assert.equal(result.servico[0].discriminacao, 'Portas|Instalação');
  assert.equal(result.servico[1].discriminacao, 'Consultoria');
});

test('payload sem serviço válido não quebra a montagem', () => {
  assert.deepEqual(applyNfseDiscriminacaoLineBreaks({}), {});
  assert.equal(applyNfseDiscriminacaoLineBreaks(null), null);

  const semDiscriminacao = { servico: [{ codigo: '141302' }, null] };
  assert.deepEqual(
    applyNfseDiscriminacaoLineBreaks(semDiscriminacao),
    { servico: [{ codigo: '141302' }, null] },
  );
});
