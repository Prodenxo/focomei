import { query, closePgPool } from '../../src/config/pg.js';

const cpf = '96232137515';

try {
  const { rows: users } = await query(
    `SELECT id, email, phone, raw_user_meta_data
     FROM public.users
     WHERE replace(replace(coalesce(raw_user_meta_data->>'cpf',''),'.',''),'-','') = $1
        OR raw_user_meta_data::text ILIKE '%962321375%'
     LIMIT 10`,
    [cpf],
  );
  console.log('users', JSON.stringify(users, null, 2));

  const { rows: empresas } = await query(
    `SELECT e.id, e.empresa, e.cnpj, e.razao_social, e.requested_by, e.email
     FROM public.empresas e
     WHERE e.empresa ILIKE '%CF ALIANCA%' OR e.razao_social ILIKE '%CF ALIANCA%'
     LIMIT 5`,
  );
  console.log('empresas', JSON.stringify(empresas, null, 2));

  if (empresas[0]) {
    const eid = empresas[0].id;
    const { rows: links } = await query(
      `SELECT rx.user_id, r.roles, u.email, u.raw_user_meta_data
       FROM public.role_x_user_x_empresa rx
       JOIN public.roles r ON r.id = rx.roles_id
       JOIN public.users u ON u.id = rx.user_id
       WHERE rx.empresas_id = $1`,
      [eid],
    );
    console.log('links', JSON.stringify(links, null, 2));

    const { rows: lines } = await query(
      `SELECT id, mei_slots, status, updated_at
       FROM public.empresa_mei_subscription_lines
       WHERE empresa_id = $1
       ORDER BY updated_at DESC LIMIT 3`,
      [eid],
    );
    console.log('lines', JSON.stringify(lines, null, 2));

    const { rows: payloadPreview } = await query(
      `SELECT u.email, u.raw_user_meta_data->>'cpf' AS cpf,
              u.raw_user_meta_data->>'full_name' AS nome
       FROM public.role_x_user_x_empresa rx
       JOIN public.roles r ON r.id = rx.roles_id AND lower(r.roles) = 'admin'
       JOIN public.users u ON u.id = rx.user_id
       WHERE rx.empresas_id = $1
       LIMIT 1`,
      [eid],
    );
    console.log('admin_signatario', JSON.stringify(payloadPreview, null, 2));
  }

  const { rows: cpfSearch } = await query(
    `SELECT id, email, raw_user_meta_data
     FROM public.users
     WHERE raw_user_meta_data::text ILIKE '%962321375%'
        OR replace(replace(coalesce(raw_user_meta_data->>'cpf',''),'.',''),'-','') = $1`,
    [cpf],
  );
  console.log('cpfSearch', JSON.stringify(cpfSearch, null, 2));
} catch (e) {
  console.error(e.message);
} finally {
  await closePgPool();
}
