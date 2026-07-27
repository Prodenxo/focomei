import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecoveryUrl } from '../src/services/password-reset-email.service.js';
import {
  signLocalAccessToken,
  verifyLocalAccessToken,
  verifyPasswordRecoveryToken,
} from '../src/services/local-auth.service.js';

test('buildRecoveryUrl monta query token_hash no domínio FocoMEI', () => {
  const redirectTo = 'https://focomei.com.br/reset-password';
  assert.equal(
    buildRecoveryUrl(redirectTo, 'hash123'),
    'https://focomei.com.br/reset-password?token_hash=hash123&type=recovery',
  );
});

test('JWT password_recovery não autentica sessão normal', () => {
  process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || 'test-jwt-secret-focomei-local';
  const token = signLocalAccessToken(
    {
      sub: '11111111-1111-1111-1111-111111111111',
      email: 'a@b.com',
      purpose: 'password_recovery',
      role: 'recovery',
    },
    3600,
  );
  assert.equal(verifyLocalAccessToken(token), null);
  const recovered = verifyPasswordRecoveryToken(token);
  assert.ok(recovered);
  assert.equal(recovered.userId, '11111111-1111-1111-1111-111111111111');
  assert.equal(recovered.email, 'a@b.com');
});

test('JWT de sessão normal não é recovery', () => {
  process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || 'test-jwt-secret-focomei-local';
  const token = signLocalAccessToken({
    sub: '11111111-1111-1111-1111-111111111111',
    email: 'a@b.com',
    role: 'authenticated',
  });
  assert.ok(verifyLocalAccessToken(token));
  assert.equal(verifyPasswordRecoveryToken(token), null);
});
