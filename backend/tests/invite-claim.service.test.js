import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecoveryUrl } from '../src/services/password-reset-email.service.js';
import {
  hashInviteToken,
  claimInviteTokenForSignup,
} from '../src/services/invite-claim.service.js';

test('hashInviteToken é determinístico', () => {
  const a = hashInviteToken('token-convite-teste-1234567890');
  const b = hashInviteToken('token-convite-teste-1234567890');
  assert.equal(a, b);
  assert.notEqual(a, hashInviteToken('outro-token'));
});

test('buildRecoveryUrl monta query token_hash no domínio FocoMEI', () => {
  const redirectTo = 'https://focomei.com.br/reset-password';
  assert.equal(
    buildRecoveryUrl(redirectTo, 'hash123'),
    'https://focomei.com.br/reset-password?token_hash=hash123&type=recovery',
  );
});

test('claimInviteTokenForSignup rejeita token curto', async () => {
  process.env.AUTH_MODE = 'local';
  await assert.rejects(
    () => claimInviteTokenForSignup('curto'),
    (err) => err?.message?.includes('Convite inválido'),
  );
});
