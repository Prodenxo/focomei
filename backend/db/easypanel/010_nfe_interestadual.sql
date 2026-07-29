-- 010_nfe_interestadual.sql
-- Aceite de responsabilidade + taxas ICMS por UF de destino (NF-e interestadual).
-- Sem motor externo: o emitente informa as taxas; a plataforma só aplica.

BEGIN;

CREATE TABLE IF NOT EXISTS public.mei_nfe_interestadual_consent (
  user_id uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  terms_version text NOT NULL,
  ip_address text,
  user_agent text,
  snapshot_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mei_nfe_interestadual_taxas (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  uf_destino char(2) NOT NULL,
  aliquota_icms numeric(7, 4) NOT NULL,
  csosn text,
  cfop text,
  metadata_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, uf_destino),
  CONSTRAINT mei_nfe_interestadual_taxas_uf_chk
    CHECK (uf_destino ~ '^[A-Z]{2}$'),
  CONSTRAINT mei_nfe_interestadual_taxas_aliq_chk
    CHECK (aliquota_icms >= 0 AND aliquota_icms <= 100)
);

CREATE INDEX IF NOT EXISTS idx_mei_nfe_interestadual_taxas_user
  ON public.mei_nfe_interestadual_taxas (user_id);

COMMIT;
