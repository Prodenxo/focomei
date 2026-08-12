import { query, closePgPool } from '../../src/config/pg.js';

const userId = '804c17bc-30f1-4b2f-b434-6b7090c57fce';

try {
  const { rows: notas } = await query(
    `SELECT id, id_integracao, status, created_at, metadata_json,
            payload_json->'tomador'->>'razaoSocial' AS cliente
     FROM public.mei_nfse
     WHERE user_id = $1
       AND (
         payload_json::text ILIKE '%Rafael Reis%'
         OR id_integracao ILIKE '%804c17bc%'
       )
     ORDER BY created_at DESC
     LIMIT 20`,
    [userId],
  );
  console.log('notas', JSON.stringify(notas, null, 2));

  const { rows: lanc } = await query(
    `SELECT id, valor, obs, criado_em
     FROM public.lancamentos_id
     WHERE user_id = $1 AND obs ILIKE '%Rafael Reis%'
     ORDER BY criado_em DESC`,
    [userId],
  );
  console.log('lancamentos', JSON.stringify(lanc, null, 2));
} catch (e) {
  console.error(e.message);
} finally {
  await closePgPool();
}
