-- Recuperação: rode isto no PgWeb SE a transaction abortou
ROLLBACK;

-- Diagnóstico
SELECT to_regclass('public.users') AS users;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;