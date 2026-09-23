import test from 'node:test';
import assert from 'node:assert/strict';
import { activationRouteToHref } from '../lib/activationStepRoutes.js';
import {
  clearMeiContractPendingSession,
  hasMeiContractPendingSession,
  readMeiContractPendingSession,
  stashMeiContractPendingSession,
} from '../lib/meiContractPendingSession.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('todos os passos de ativação conhecidos têm destino no Next', () => {
  const routes = [
    'settings:profile',
    'settings:phone',
    'settings:google',
    'contas:new',
    'transactions:new',
    'orcamentos',
    'mei:certificate',
    'mei:das',
    'mei:nfse',
  ];

  for (const route of routes) {
    assert.ok(activationRouteToHref(route), `rota sem destino: ${route}`);
  }
});

test('contrato pendente fica salvo por usuário até a liberação', () => {
  global.window = {
    localStorage: createStorage(),
    sessionStorage: createStorage(),
  };

  stashMeiContractPendingSession('usuario-1', {
    lineId: 'linha-1',
    signingUrl: 'https://assinatura.exemplo/1',
    contratoOnetyId: 123,
  });

  const pending = readMeiContractPendingSession('usuario-1');
  assert.equal(pending.lineId, 'linha-1');
  assert.equal(pending.contratoOnetyId, 123);
  assert.equal(hasMeiContractPendingSession(pending), true);

  clearMeiContractPendingSession('usuario-1');
  assert.equal(readMeiContractPendingSession('usuario-1'), null);
  delete global.window;
});
