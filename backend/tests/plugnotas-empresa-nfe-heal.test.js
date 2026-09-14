import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNnfFromNfeChaveAcesso,
  isPlugnotasNfeDuplicidadeMessage,
  readNfeNumeroFromPlugnotasBody,
  resolveNextNfeNumeroFromSources,
  buildPlugnotasNfeConfigForNumeracaoPatch,
} from '../src/services/plugnotas/plugnotas-empresa-nfe-heal.js';

test('parseNnfFromNfeChaveAcesso extrai nNF da posição 26-34', () => {
  const chave = '33260812345678000100550010000000011412345678';
  assert.equal(parseNnfFromNfeChaveAcesso(chave), 1);
  const chave16 = '33260812345678000100550010000000161412345678';
  assert.equal(parseNnfFromNfeChaveAcesso(chave16), 16);
});

test('readNfeNumeroFromPlugnotasBody prioriza chave', () => {
  const body = {
    chave: '33260812345678000100550010000000161412345678',
    numero: 1,
  };
  assert.equal(readNfeNumeroFromPlugnotasBody(body), 16);
});

test('isPlugnotasNfeDuplicidadeMessage', () => {
  const msg = 'Duplicidade de NF-e, com diferença na Chave de Acesso [chNFe:332608...000000001...]';
  assert.equal(isPlugnotasNfeDuplicidadeMessage(msg), true);
  const c613 = 'Rejeicao: Chave de Acesso difere da existente em BD  Rejeicao: Codigo Numerico informado na Chave de Acesso difere do Codigo Numerico da NF-e [33260967593254000131550010000000011418766239]';
  assert.equal(isPlugnotasNfeDuplicidadeMessage(c613), true);
  assert.equal(isPlugnotasNfeDuplicidadeMessage('Rejeição genérica'), false);
});

test('buildPlugnotasNfeConfigForNumeracaoPatch grava numeracao[] e preserva pl_010e', () => {
  const config = buildPlugnotasNfeConfigForNumeracaoPatch(
    {
      producao: true,
      numeracao: { tipoEmissao: 'Normal' },
      versaoEsquema: 'pl_010e',
    },
    { serie: 1, numero: 17 },
  );
  assert.equal(Array.isArray(config.numeracao), true);
  assert.equal(config.numeracao[0].numero, 17);
  assert.equal(config.numeracao[0].numeracaoAtual, 17);
  assert.equal(config.numero, 17);
  assert.equal(config.serie, 1);
  assert.equal(config.versaoEsquema, 'pl_010e');
});

test('resolveNextNfeNumeroFromSources respeita cadastro PlugNotas e histórico', () => {
  assert.equal(
    resolveNextNfeNumeroFromSources({ empresaNumero: 16, localMaxNumero: 14, periodoMaxNumero: 0 }),
    16,
  );
  assert.equal(
    resolveNextNfeNumeroFromSources({ empresaNumero: 1, localMaxNumero: 0, periodoMaxNumero: 14 }),
    15,
  );
  assert.equal(
    resolveNextNfeNumeroFromSources({ empresaNumero: 0, localMaxNumero: 0, periodoMaxNumero: 14 }),
    15,
  );
  assert.equal(
    resolveNextNfeNumeroFromSources({ empresaNumero: 16, localMaxNumero: 0, periodoMaxNumero: 0 }),
    16,
  );
});
