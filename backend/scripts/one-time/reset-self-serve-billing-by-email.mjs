#!/usr/bin/env node
/**
 * Zera planos MEI / contrato self-serve de um admin para retestar /planos.
 *
 * Uso (pasta backend, .env de produção):
 *   node scripts/one-time/reset-self-serve-billing-by-email.mjs dhunningan@gmail.com
 *   node scripts/one-time/reset-self-serve-billing-by-email.mjs dhunningan@gmail.com --apply
 */
import { createSupabaseClient } from '../../src/config/supabase.js';
import { query } from '../../src/config/pg.js';
import { reconcileMeiModuleConsistency } from '../../src/services/users.service.js';

const emailArg = String(process.argv[2] || '').trim().toLowerCase();
const apply = process.argv.includes('--apply');

if (!emailArg || !emailArg.includes('@')) {
  console.error('Uso: node scripts/one-time/reset-self-serve-billing-by-email.mjs EMAIL [--apply]');
  process.exit(1);
}

const admin = createSupabaseClient({ useServiceRole: true });

let user = null;

const { data: userRow, error: userErr } = await admin
  .from('users')
  .select('id, email')
  .ilike('email', emailArg)
  .is('deleted_at', null)
  .maybeSingle();

if (userErr) {
  console.error('Erro ao buscar usuário:', userErr.message);
  process.exit(1);
}

if (userRow?.id) {
  user = userRow;
} else {
  try {
    const { rows } = await query(
      `SELECT id, email
       FROM public.users
       WHERE lower(trim(email)) = lower(trim($1))
         AND deleted_at IS NULL
       LIMIT 1`,
      [emailArg],
    );
    if (rows[0]?.id) user = rows[0];
  } catch (pgErr) {
    console.warn('Fallback PG users:', pgErr.message);
  }
}

if (!user?.id && admin.auth?.admin?.listUsers) {
  const { data: authData, error: authErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 500,
  });
  if (!authErr) {
    const authUser = (authData?.users || []).find(
      (u) => String(u.email || '').trim().toLowerCase() === emailArg,
    );
    if (authUser?.id) user = { id: authUser.id, email: authUser.email };
  }
}

if (!user?.id) {
  console.error('Usuário não encontrado:', emailArg);
  process.exit(1);
}

const { data: links, error: linkErr } = await admin
  .from('role_x_user_x_empresa')
  .select('id, empresas_id, roles_id, mei, status, roles:roles_id(roles)')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });

if (linkErr) {
  console.error('Erro ao buscar vínculo empresa:', linkErr.message);
  process.exit(1);
}

const adminLink = (links || []).find((l) => {
  const role = String(l.roles?.roles || '').toLowerCase();
  return role === 'admin' && l.status !== false;
}) || (links || [])[0];

if (!adminLink?.empresas_id) {
  console.error('Nenhuma empresa vinculada ao usuário', user.email);
  process.exit(1);
}

const empresaId = adminLink.empresas_id;

const { data: empresa, error: empErr } = await admin
  .from('empresas')
  .select('id, empresa, razao_social, cnpj, max_mei')
  .eq('id', empresaId)
  .maybeSingle();

if (empErr || !empresa?.id) {
  console.error('Empresa não encontrada:', empErr?.message || empresaId);
  process.exit(1);
}

const { data: lines, error: linesErr } = await admin
  .from('empresa_mei_subscription_lines')
  .select('id, status, billing_type, mei_slots, created_at')
  .eq('empresa_id', empresaId)
  .order('created_at', { ascending: false });

if (linesErr) {
  console.error('Erro ao listar linhas MEI:', linesErr.message);
  process.exit(1);
}

console.log('--- Reset self-serve billing (dry-run:', !apply, ') ---');
console.log('Usuário:', user.email, user.id);
console.log('Empresa:', empresa.razao_social || empresa.empresa, empresa.id);
console.log('CNPJ:', empresa.cnpj || '—');
console.log('max_mei atual:', empresa.max_mei ?? 0);
console.log('Linhas MEI encontradas:', (lines || []).length);
for (const line of lines || []) {
  console.log(
    ' -',
    line.id,
    line.status,
    line.billing_type || '—',
    `${line.mei_slots} vagas`,
  );
}

if (!apply) {
  console.log('\nNada alterado. Rode com --apply para executar.');
  process.exit(0);
}

const lineIds = (lines || []).map((l) => l.id).filter(Boolean);
if (lineIds.length > 0) {
  const { error: delErr } = await admin
    .from('empresa_mei_subscription_lines')
    .delete()
    .in('id', lineIds);

  if (delErr) {
    console.error('Falha ao excluir linhas:', delErr.message);
    process.exit(1);
  }
  console.log('Excluídas', lineIds.length, 'linha(s) MEI');
}

const { error: maxErr } = await admin
  .from('empresas')
  .update({ max_mei: 0 })
  .eq('id', empresaId);

if (maxErr) {
  console.error('Falha ao zerar max_mei:', maxErr.message);
  process.exit(1);
}

const { error: meiErr } = await admin
  .from('role_x_user_x_empresa')
  .update({ mei: false })
  .eq('empresas_id', empresaId)
  .eq('status', true);

if (meiErr) {
  console.error('Falha ao desativar mei nos vínculos:', meiErr.message);
  process.exit(1);
}

const reconcile = await reconcileMeiModuleConsistency(admin, [empresaId], { dryRun: false });

console.log('max_mei → 0');
console.log('mei → false nos vínculos ativos');
console.log('Reconcile:', reconcile);
console.log('\nOK — peça ao usuário sair e entrar de novo; deve ir para /planos.');
console.log('No browser: limpe localStorage key mei_contract_pending_v1:* se ainda aparecer aguardando-contrato.');
