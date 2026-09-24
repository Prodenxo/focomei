import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildActivationSteps,
  computeProgressFromSteps,
} from '../src/services/activation.service.js';

/** Rotas que o app sabe abrir — espelha ACTIVATION_ROUTE_TO_SCREEN no frontend. */
const ROTAS_COM_TELA = new Set([
  'settings:profile',
  'settings:phone',
  'mei:certificate',
  'mei:das',
  'mei:nfse',
]);

const ctxMeiCompleto = {
  hasProfileName: true,
  hasPhone: true,
  hasMeiCertificate: true,
  hasDasActivity: true,
  nfseClientsCount: 2,
};

test('todo passo do checklist tem tela correspondente no app', () => {
  const steps = buildActivationSteps(ctxMeiCompleto, { showMei: true });
  const semTela = steps.filter((step) => !ROTAS_COM_TELA.has(step.route));
  assert.deepEqual(semTela, []);
});

test('MEI com tudo configurado conclui o checklist e sai da tela de ativação', () => {
  const steps = buildActivationSteps(ctxMeiCompleto, { showMei: true });
  const progress = computeProgressFromSteps(steps);

  assert.equal(steps.length, 5);
  assert.equal(progress.isCoreComplete, true);
  assert.equal(progress.isFullyComplete, true);
  assert.equal(progress.pendingCount, 0);
});

test('certificado pendente não bloqueia o essencial, só o checklist completo', () => {
  const steps = buildActivationSteps(
    { ...ctxMeiCompleto, hasMeiCertificate: false },
    { showMei: true },
  );
  const progress = computeProgressFromSteps(steps);

  assert.equal(progress.isCoreComplete, true);
  assert.equal(progress.isFullyComplete, false);
  assert.equal(
    steps.find((step) => step.id === 'mei_certificate').status,
    'pending',
  );
});

test('sem nome ou WhatsApp o usuário continua sendo levado para a ativação', () => {
  const steps = buildActivationSteps(
    { ...ctxMeiCompleto, hasPhone: false },
    { showMei: true },
  );
  const progress = computeProgressFromSteps(steps);

  assert.equal(progress.isCoreComplete, false);
  assert.equal(progress.completed, 1);
  assert.equal(progress.totalRequired, 2);
});
