-- Smoke pós-import FocoMEI (rodar no Postgres destino)
-- Comparar com 00_manifest.json → counts

SELECT 'empresas' AS metric, COUNT(*)::int AS n FROM public.empresas
UNION ALL
SELECT 'users', COUNT(*)::int FROM public.users WHERE deleted_at IS NULL
UNION ALL
SELECT 'profiles', COUNT(*)::int FROM public.profiles
UNION ALL
SELECT 'vinculos_ativos', COUNT(*)::int FROM public.role_x_user_x_empresa WHERE status IS TRUE
UNION ALL
SELECT 'vinculos_mei_true', COUNT(*)::int FROM public.role_x_user_x_empresa WHERE status IS TRUE AND mei IS TRUE
UNION ALL
SELECT 'lancamentos_id', COUNT(*)::int FROM public.lancamentos_id
UNION ALL
SELECT 'mei_nfse', COUNT(*)::int FROM public.mei_nfse
UNION ALL
SELECT 'user_mei_certificates', COUNT(*)::int FROM public.user_mei_certificates
UNION ALL
SELECT 'categorias_id', COUNT(*)::int FROM public.categorias_id
UNION ALL
SELECT 'n8n_link', COUNT(*)::int FROM public.n8n_link
ORDER BY 1;

-- Sample 3 empresas com admin + mei
SELECT
  e.id,
  e.empresa,
  e.max_mei,
  COUNT(*) FILTER (WHERE r.mei IS TRUE AND r.status IS TRUE) AS mei_users,
  COUNT(*) FILTER (
    WHERE r.status IS TRUE AND lower(roles.roles) IN ('admin', 'superadmin')
  ) AS admins
FROM public.empresas e
LEFT JOIN public.role_x_user_x_empresa r ON r.empresas_id = e.id
LEFT JOIN public.roles ON roles.id = r.roles_id
GROUP BY e.id, e.empresa, e.max_mei
HAVING COUNT(*) FILTER (WHERE r.mei IS TRUE AND r.status IS TRUE) > 0
ORDER BY mei_users DESC
LIMIT 3;

-- Empresas max_mei > 0 sem usuário mei (esperado: 6 no manifesto)
SELECT e.id, e.empresa, e.max_mei, e.cnpj
FROM public.empresas e
WHERE COALESCE(e.max_mei, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.role_x_user_x_empresa r
    WHERE r.empresas_id = e.id AND r.mei IS TRUE AND r.status IS TRUE
  )
ORDER BY e.empresa;
