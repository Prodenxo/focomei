/**
 * Remove lançamentos duplicados gerados pelo sync nota → extrato.
 *
 * Uso:
 *   node scripts/one-time/dedupe-lancamentos-nota.mjs --dry-run
 *   node scripts/one-time/dedupe-lancamentos-nota.mjs --apply
 *   node scripts/one-time/dedupe-lancamentos-nota.mjs --apply --user-id=<uuid>
 */
import { query, closePgPool } from '../../src/config/pg.js';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const dryRun = !apply || args.has('--dry-run');
const userIdArg = [...args].find((a) => a.startsWith('--user-id='))?.split('=')[1]?.trim();

const report = {
  mode: apply && !dryRun ? 'apply' : 'dry-run',
  duplicatesRemoved: [],
  cancelledNoteLancamentosRemoved: [],
  errors: [],
};

const pickKeeperId = (ids, linkedId) => {
  if (linkedId && ids.includes(linkedId)) return linkedId;
  return ids[0];
};

try {
  const userFilter = userIdArg ? 'AND l.user_id = $1' : '';
  const params = userIdArg ? [userIdArg] : [];

  const { rows: dupGroups } = await query(
    `SELECT l.user_id, l.obs, COUNT(*)::int AS n,
            array_agg(l.id ORDER BY l.criado_em ASC) AS ids
     FROM public.lancamentos_id l
     WHERE l.obs ILIKE 'NFS-e %'
       ${userFilter}
     GROUP BY l.user_id, l.obs
     HAVING COUNT(*) > 1`,
    params,
  );

  for (const group of dupGroups) {
    const ids = group.ids || [];
    if (ids.length < 2) continue;

    const { rows: linkedRows } = await query(
      `SELECT metadata_json->>'lancamento_id' AS lancamento_id
       FROM public.mei_nfse
       WHERE user_id = $1
         AND metadata_json->>'lancamento_id' = ANY($2::text[])`,
      [group.user_id, ids],
    );

    const linkedId = linkedRows[0]?.lancamento_id || null;
    const keeperId = pickKeeperId(ids, linkedId);
    const toDelete = ids.filter((id) => id !== keeperId);

    for (const id of toDelete) {
      report.duplicatesRemoved.push({
        user_id: group.user_id,
        obs: group.obs,
        keeper_id: keeperId,
        deleted_id: id,
      });

      if (apply && !dryRun) {
        await query(
          'DELETE FROM public.lancamentos_id WHERE id = $1 AND user_id = $2',
          [id, group.user_id],
        );
      }
    }
  }

  const { rows: cancelledWithLanc } = await query(
    `SELECT n.id AS nota_id, n.user_id, n.id_integracao, n.status,
            n.metadata_json->>'lancamento_id' AS lancamento_id,
            l.obs
     FROM public.mei_nfse n
     JOIN public.lancamentos_id l
       ON l.id::text = n.metadata_json->>'lancamento_id'
      AND l.user_id = n.user_id
     WHERE lower(coalesce(n.status, '')) IN ('cancelado', 'cancelada', 'rejeitado', 'rejeitada')
       ${userIdArg ? 'AND n.user_id = $1' : ''}`,
    userIdArg ? [userIdArg] : [],
  );

  for (const row of cancelledWithLanc) {
    report.cancelledNoteLancamentosRemoved.push({
      nota_id: row.nota_id,
      user_id: row.user_id,
      lancamento_id: row.lancamento_id,
      status: row.status,
      obs: row.obs,
    });

    if (apply && !dryRun) {
      await query(
        'DELETE FROM public.lancamentos_id WHERE id = $1 AND user_id = $2',
        [row.lancamento_id, row.user_id],
      );
      await query(
        `UPDATE public.mei_nfse
         SET metadata_json = metadata_json - 'lancamento_id' - 'lancamentoSyncedAt',
             updated_at = now()
         WHERE id = $1 AND user_id = $2`,
        [row.nota_id, row.user_id],
      );
    }
  }

  const { rows: orphanCancelled } = await query(
    `SELECT l.id, l.user_id, l.obs
     FROM public.lancamentos_id l
     WHERE l.obs ILIKE 'NFS-e %'
       AND EXISTS (
         SELECT 1 FROM public.mei_nfse n
         WHERE n.user_id = l.user_id
           AND n.id_integracao IS NOT NULL
           AND l.obs ILIKE ('%' || n.id_integracao || '%')
           AND lower(coalesce(n.status, '')) IN ('cancelado', 'cancelada', 'rejeitado', 'rejeitada')
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.mei_nfse n2
         WHERE n2.user_id = l.user_id
           AND n2.metadata_json->>'lancamento_id' = l.id::text
       )
       ${userIdArg ? 'AND l.user_id = $1' : ''}`,
    userIdArg ? [userIdArg] : [],
  );

  for (const row of orphanCancelled) {
    const alreadyListed = report.cancelledNoteLancamentosRemoved.some(
      (item) => item.lancamento_id === row.id,
    );
    if (alreadyListed) continue;

    report.cancelledNoteLancamentosRemoved.push({
      user_id: row.user_id,
      lancamento_id: row.id,
      obs: row.obs,
      reason: 'orphan_cancelled_note',
    });

    if (apply && !dryRun) {
      await query(
        'DELETE FROM public.lancamentos_id WHERE id = $1 AND user_id = $2',
        [row.id, row.user_id],
      );
    }
  }

  console.log(JSON.stringify(report, null, 2));
} catch (err) {
  report.errors.push(err instanceof Error ? err.message : String(err));
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  await closePgPool();
}
