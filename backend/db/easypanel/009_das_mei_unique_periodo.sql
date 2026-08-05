-- Garante upsert de PDF DAS por usuário + competência (AUTH_MODE=local / EasyPanel)
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS das_mei_user_id_periodo_apuracao_key
  ON public.das_mei (user_id, periodo_apuracao);

COMMIT;
