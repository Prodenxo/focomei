#!/usr/bin/env node
/**
 * Renomeia e-mail do usuário + reset self-serve billing.
 *
 * Uso:
 *   node scripts/one-time/rename-and-reset-billing-email.mjs DE PARA --apply
 */
import { createSupabaseClient } from '../../src/config/supabase.js';
import { query } from '../../src/config/pg.js';
import { reconcileMeiModuleConsistency } from '../../src/services/users.service.js';

const fromEmail = String(process.argv[2] || '').trim().toLowerCase();
const toEmail = String(process.argv[3] || '').trim().toLowerCase();
const apply = process.argv.includes('--apply');

if (!fromEmail || !toEmail || !fromEmail.includes('@') || !toEmail.includes('@')) {
  console.error('Uso: node rename-and-reset-billing-email.mjs DE PARA [--apply]');
  process.exit(1);
}

const admin = createSupabaseClient({ useServiceRole: true });

const { rows: fromRows } = await query(
  `SELECT id, email FROM public.users
   WHERE lower(trim(email)) = lower(trim($1)) AND deleted_at IS NULL LIMIT 1`,
  [fromEmail],
);

const user = fromRows[0];
if (!user?.id) {
  console.error('Usuário origem não encontrado:', fromEmail);
  process.exit(1);
}

const { rows: clash } = await query(
  `SELECT id, email FROM public.users
   WHERE lower(trim(email)) = lower(trim($1)) AND deleted_at IS NULL AND id <> $2 LIMIT 1`,
  [toEmail, user.id],
);

if (clash[0]?.id) {
  console.error('E-mail destino já em uso:', toEmail, clash[0].id);
  process.exit(1);
}

console.log('--- Renomear + reset (dry-run:', !apply, ') ---');
console.log('De:', fromEmail);
console.log('Para:', toEmail);
console.log('User id:', user.id);

if (apply) {
  await query(
    `UPDATE public.users SET email = $1 WHERE id = $2`,
    [toEmail, user.id],
  );
  try {
    await query(
      `UPDATE auth.users SET email = $1, raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', $1)
       WHERE id = $2`,
      [toEmail, user.id],
    );
    console.log('auth.users atualizado');
  } catch (e) {
    console.warn('auth.users skip:', e.message);
  }
  console.log('E-mail atualizado em public.users');
}

// Reset billing (reuse logic inline)
const { data: links, error: linkErr } = await admin
  .from('role_x_user_x_empresa')
  .select('id, empresas_id, roles_id, mei, status, roles:roles_id(roles)')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });

if (linkErr) {
  console.error('Erro vínculo empresa:', linkErr.message);
  process.exit(1);
}

const adminLink = (links || []).find((l) => {
  const role = String(l.roles?.roles || '').toLowerCase();
  return role === 'admin' && l.status !== false;
}) || (links || [])[0];

if (!adminLink?.empresas_id) {
  console.error('Sem empresa vinculada');
  process.exit(1);
}

const empresaId = adminLink.empresas_id;

const { data: empresa } = await admin
  .from('empresas')
  .select('id, empresa, razao_social, cnpj, max_mei')
  .eq('id', empresaId)
  .maybeSingle();

const { data: lines } = await admin
  .from('empresa_mei_subscription_lines')
  .select('id, status, billing_type, mei_slots, created_at')
  .eq('empresa_id', empresaId)
  .order('created_at', { ascending: false });

console.log('Empresa:', empresa?.razao_social || empresa?.empresa, empresaId);
console.log('Linhas MEI:', (lines || []).length);
for (const line of lines || []) {
  console.log(' -', line.id, line.status, line.billing_type, line.mei_slots);
}

if (!apply) {
  console.log('\nNada alterado. Use --apply.');
  process.exit(0);
}

const lineIds = (lines || []).map((l) => l.id).filter(Boolean);
if (lineIds.length) {
  const { error: delErr } = await admin
    .from('empresa_mei_subscription_lines')
    .delete()
    .in('id', lineIds);
  if (delErr) {
    console.error('Falha excluir linhas:', delErr.message);
    process.exit(1);
  }
  console.log('Excluídas', lineIds.length, 'linha(s)');
}

await admin.from('empresas').update({ max_mei: 0 }).eq('id', empresaId);
await admin
  .from('role_x_user_x_empresa')
  .update({ mei: false })
  .eq('empresas_id', empresaId)
  .eq('status', true);

await reconcileMeiModuleConsistency(admin, [empresaId], { dryRun: false });

console.log('\nOK — login com', toEmail, '→ /planos');
console.log('Limpe localStorage mei_contract_pending_v1:* se necessário.');
