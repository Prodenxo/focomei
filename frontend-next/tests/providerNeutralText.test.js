import test from 'node:test';
import assert from 'node:assert/strict';

import { neutralizeProviderNames } from '../lib/providerNeutralText.js';

test('remove nomes de fornecedores das mensagens mostradas ao usuário', () => {
  const message = neutralizeProviderNames(
    'PlugNotas recusou. TecnoSpeed, SERPRO, Supabase, Stripe, Onety, Z-API, n8n e OpenClaw.',
  );

  for (const provider of [
    'PlugNotas',
    'TecnoSpeed',
    'SERPRO',
    'Supabase',
    'Stripe',
    'Onety',
    'Z-API',
    'n8n',
    'OpenClaw',
  ]) {
    assert.doesNotMatch(message, new RegExp(provider, 'i'));
  }
  assert.match(message, /emissor fiscal/i);
  assert.match(message, /serviço de pagamento/i);
});

test('não altera uma mensagem comum do FocoMEI', () => {
  const message = 'Não foi possível emitir a nota. Tente novamente.';
  assert.equal(neutralizeProviderNames(message), message);
});
