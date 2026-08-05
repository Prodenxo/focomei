-- EasyPanel / AUTH_MODE=local: índice único em das_mei (tabela lowercase)
CREATE UNIQUE INDEX IF NOT EXISTS das_mei_user_id_periodo_apuracao_key
  ON public.das_mei (user_id, periodo_apuracao);
