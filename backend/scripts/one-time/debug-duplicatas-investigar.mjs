import { query, closePgPool } from '../../src/config/pg.js';

try {
  const { rows: lanc } = await query(
    `SELECT l.id, l.user_id, l.valor, l.classificacao, l.data, l.status, l.obs, l.criado_em
     FROM public.lancamentos_id l
     WHERE l.obs ILIKE '%1786468943663%'
        OR l.obs ILIKE '%1786456631379%'
        OR l.obs ILIKE '%INSTITUTO ELO%'
     ORDER BY l.criado_em DESC LIMIT 20`,
  );
  console.log('lancamentos', JSON.stringify(lanc, null, 2));

  const userIds = [...new Set(lanc.map((r) => r.user_id))];
  if (userIds.length) {
    const { rows: profiles } = await query(
      `SELECT u.id, u.email, u.raw_user_meta_data
       FROM public.users u WHERE u.id = ANY($1::uuid[])`,
      [userIds],
    );
    console.log('users', JSON.stringify(profiles, null, 2));
  }

  const { rows: notas } = await query(
    `SELECT id, id_integracao, status, metadata_json, created_at, plugnotas_id, protocol
     FROM public.mei_nfse
     WHERE id_integracao ILIKE '%1786468943663%'
        OR id_integracao ILIKE '%1786456631379%'
        OR metadata_json::text ILIKE '%INSTITUTO ELO%'
     ORDER BY created_at DESC LIMIT 20`,
  );
  console.log('notas', JSON.stringify(notas, null, 2));

  const { rows: dupObs } = await query(
    `SELECT obs, COUNT(*)::int AS n, array_agg(id ORDER BY criado_em) AS ids
     FROM public.lancamentos_id
     WHERE user_id = '0b29c5db-fbc6-48e7-999d-59d1cdc10b15'
       AND obs ILIKE '%INSTITUTO ELO%'
     GROUP BY obs
     HAVING COUNT(*) > 1`,
  );
  console.log('dupObs', JSON.stringify(dupObs, null, 2));

  const { rows: aug10 } = await query(
    `SELECT id, status, id_integracao, metadata_json
     FROM public.mei_nfse
     WHERE id_integracao ILIKE '%1786396086095%'`,
  );
  console.log('aug10nota', JSON.stringify(aug10, null, 2));
} catch (e) {
  console.error(e.message);
} finally {
  await closePgPool();
}
