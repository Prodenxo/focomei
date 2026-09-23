import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterAdminEmpresas,
  isValidCpf,
  listEmpresaMembers,
  mapStripeReturn,
} from '../lib/adminManagementHelpers.js';

const empresas = [
  { id: '2', empresa: 'Beta', cnpj: '222', max_mei: 0, access_status: 'blocked' },
  { id: '1', empresa: 'Árvore Contábil', cnpj: '111', max_mei: 5, access_status: 'active' },
];
const users = [
  { id: 'u2', empresaId: '1', displayName: 'Zeca', email: 'zeca@example.com' },
  { id: 'u1', empresaId: '1', displayName: 'Ana', email: 'ana@example.com' },
];

test('filtra empresas por texto, acesso e situação MEI', () => {
  assert.deepEqual(
    filterAdminEmpresas(empresas, users, { search: 'arvore', access: 'active', mei: 'active' })
      .map((item) => item.id),
    ['1'],
  );
  assert.deepEqual(
    filterAdminEmpresas(empresas, users, { search: 'ana' }).map((item) => item.id),
    ['1'],
  );
  assert.deepEqual(
    filterAdminEmpresas(empresas, users, { access: 'blocked', mei: 'inactive' })
      .map((item) => item.id),
    ['2'],
  );
});

test('mapeia e ordena membros da empresa', () => {
  assert.deepEqual(listEmpresaMembers(users, '1').map((item) => item.id), ['u1', 'u2']);
});

test('valida CPF e retorno Stripe', () => {
  assert.equal(isValidCpf('529.982.247-25'), true);
  assert.equal(isValidCpf('111.111.111-11'), false);
  const params = new URLSearchParams('stripe_mei=success&session_id=cs_123');
  assert.deepEqual(mapStripeReturn(params), {
    status: 'success',
    checkoutSessionId: 'cs_123',
  });
});
