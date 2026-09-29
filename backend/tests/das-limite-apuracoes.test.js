import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dasLimiteApuracoesError,
  isDasLimiteApuracoesError,
  isDasLimiteApuracoesSerproMessage,
  isSerproUnavailableError,
} from '../src/services/mei-guide-serpro-period-guard.js';
import { canFallbackToStoredDas } from '../src/services/mei-das-vencimento.js';

const MENSAGEM_REAL = '[[Erro-PGMEI-23999]] 23999-Falha ao Gerar a Apuração, limite máximo excedido!';

test('mensagem 23999 da Receita é reconhecida como limite de apurações, não como Receita fora do ar', () => {
  assert.equal(isDasLimiteApuracoesSerproMessage(MENSAGEM_REAL), true);
  assert.equal(isDasLimiteApuracoesSerproMessage(
    '[Erro-PGMEI-MSG_23028] Número máximo de Apurações PGMEI para o Ano Calendário excedido.'
  ), true);
  assert.equal(isDasLimiteApuracoesSerproMessage('Internal Server Error'), false);
  assert.equal(isDasLimiteApuracoesSerproMessage(''), false);
});

test('erro classificado carrega o motivo real e um texto claro para o cliente', () => {
  const err = dasLimiteApuracoesError(MENSAGEM_REAL);
  assert.equal(err.status, 400);
  assert.equal(err.errors.code, 'MEI_DAS_LIMITE_APURACOES');
  assert.equal(err.errors.serproMessage, MENSAGEM_REAL);
  assert.match(err.message, /Fale Conosco da Receita Federal/);
  assert.doesNotMatch(err.message, /indisponível|fora do ar/i);
  assert.equal(isDasLimiteApuracoesError(err), true);
  assert.equal(isSerproUnavailableError(err), false);
});

test('erro 503 antigo com a mensagem 23999 escondida em upstreamMessage também é reconhecido', () => {
  const legado = {
    status: 503,
    message: 'O serviço da Receita Federal está temporariamente indisponível. Tente novamente em alguns minutos.',
    errors: { code: 'MEI_GUIDE_SERPRO_UNAVAILABLE', upstreamStatus: 500, upstreamMessage: MENSAGEM_REAL },
  };
  assert.equal(isDasLimiteApuracoesError(legado), true);
  assert.equal(isSerproUnavailableError(legado), false);
});

test('com o CNPJ bloqueado no PGMEI, a guia guardada ainda serve de reserva', () => {
  assert.equal(canFallbackToStoredDas({ limiteApuracoes: true, hasStored: true }), true);
  assert.equal(canFallbackToStoredDas({ limiteApuracoes: true, hasStored: false }), false);
});
