import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_REQUEST_HREF,
  APP_HOME_HREF,
  LOGIN_HREF,
  PUBLIC_HOME_HREF,
  isAppHomePath,
  resolveRootHref,
} from '../lib/appRoutes.js';

test('a raiz pública e a visão geral autenticada usam rotas diferentes', () => {
  assert.equal(PUBLIC_HOME_HREF, '/');
  assert.equal(APP_HOME_HREF, '/visao-geral');
  assert.equal(resolveRootHref(false), '/');
  assert.equal(resolveRootHref(true), '/visao-geral');
});

test('os CTAs públicos apontam para login e solicitação de acesso', () => {
  assert.equal(LOGIN_HREF, '/login');
  assert.equal(ACCESS_REQUEST_HREF, '/solicitar-acesso');
});

test('a rota canônica da visão geral reconhece apenas seu segmento', () => {
  assert.equal(isAppHomePath('/visao-geral'), true);
  assert.equal(isAppHomePath('/visao-geral/detalhe'), true);
  assert.equal(isAppHomePath('/'), false);
  assert.equal(isAppHomePath('/visao-geral-antiga'), false);
});
