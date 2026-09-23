import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  OFFICE_BLOCKED_CODE,
  OFFICE_CONTEXT_FORBIDDEN_CODE,
  PROFILE_BLOCKED_CODE,
  evaluateAccessSnapshot,
} from '../src/services/access-control.service.js';
import {
  assertCanManageOfficeAccess,
  buildListUsersPgLinkJoin,
} from '../src/services/users.service.js';

const membership = (overrides = {}) => ({
  id: 'link-1',
  empresaId: 'empresa-1',
  role: 'usuario',
  status: true,
  officeStatus: 'active',
  createdAt: '2026-09-17T10:00:00.000Z',
  ...overrides,
});

test('mantém o funcionamento de escritório ativo', () => {
  const result = evaluateAccessSnapshot({ memberships: [membership()] });
  assert.equal(result.allowed, true);
  assert.equal(result.empresaId, 'empresa-1');
});

test('bloqueia escritório na próxima validação sem alterar o usuário', () => {
  const result = evaluateAccessSnapshot({
    memberships: [membership({ officeStatus: 'blocked' })],
  });
  assert.equal(result.allowed, false);
  assert.equal(result.code, OFFICE_BLOCKED_CODE);
});

test('bloqueio individual prevalece mesmo com escritório ativo', () => {
  const result = evaluateAccessSnapshot({
    memberships: [membership({ status: false })],
  });
  assert.equal(result.allowed, false);
  assert.equal(result.code, PROFILE_BLOCKED_CODE);
});

test('usuário com vários vínculos continua no escritório autorizado', () => {
  const result = evaluateAccessSnapshot({
    memberships: [
      membership({ empresaId: 'bloqueado', officeStatus: 'blocked' }),
      membership({ id: 'link-2', empresaId: 'ativo', officeStatus: 'active' }),
    ],
  });
  assert.equal(result.allowed, true);
  assert.equal(result.empresaId, 'ativo');
});

test('não permite trocar o contexto para escritório sem vínculo ativo', () => {
  const result = evaluateAccessSnapshot(
    { memberships: [membership()] },
    { selectedEmpresaId: 'empresa-alheia' },
  );
  assert.equal(result.allowed, false);
  assert.equal(result.code, OFFICE_CONTEXT_FORBIDDEN_CODE);
});

test('superadmin acessa gestão, mas não opera em escritório suspenso', () => {
  const snapshot = {
    profileRole: 'superadmin',
    memberships: [
      membership({
        role: 'superadmin',
        officeStatus: 'blocked',
      }),
    ],
  };
  const operation = evaluateAccessSnapshot(snapshot, {
    selectedEmpresaId: 'empresa-1',
  });
  const management = evaluateAccessSnapshot(snapshot, {
    selectedEmpresaId: 'empresa-1',
    allowBlockedOfficeManagement: true,
  });
  assert.equal(operation.allowed, false);
  assert.equal(operation.code, OFFICE_BLOCKED_CODE);
  assert.equal(management.allowed, true);
});

test('desbloquear escritório não libera usuário bloqueado individualmente', () => {
  const result = evaluateAccessSnapshot({
    memberships: [membership({ status: false, officeStatus: 'active' })],
  });
  assert.equal(result.allowed, false);
  assert.equal(result.code, PROFILE_BLOCKED_CODE);
});

test('somente superadmin pode bloquear por chamada direta à API', () => {
  assert.doesNotThrow(() => assertCanManageOfficeAccess('superadmin'));
  for (const role of ['admin', 'contador', 'colaborador', 'usuario', 'outsider']) {
    assert.throws(
      () => assertCanManageOfficeAccess(role),
      (error) => error?.status === 403,
    );
  }
});

test('listagem local mantém usuário bloqueado visível para permitir desbloqueio', () => {
  const scopedJoin = buildListUsersPgLinkJoin(1);
  assert.doesNotMatch(scopedJoin, /COALESCE\(status,\s*true\)\s*=\s*true/i);
  assert.match(scopedJoin, /empresas_id = \$1/);
});

test('migração protege acessos diretos por RLS e restringe vínculo cross-tenant', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20260917100000_office_access_blocking.sql', import.meta.url),
    'utf8',
  );
  assert.match(sql, /current_access_allowed\(\)/);
  assert.match(sql, /as restrictive for all to authenticated/i);
  assert.match(sql, /empresas_id = public\.current_empresa_id\(\)/);
});
