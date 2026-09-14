import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNnfFromNfeChaveAcesso,
  isPlugnotasNfeDuplicidadeMessage,
  readNfeNumeroFromPlugnotasBody,
  resolveNextNfeNumeroFromSources,
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
  assert.equal(isPlugnotasNfeDuplicidadeMessage('Rejeição genérica'), false);
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
    resolveNextNfeNumeroFromSources({ empresaNumero: 16, localMaxNumero: 0, periodoMaxNumero: 0 }),
    16,
  );
});
