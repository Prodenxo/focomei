-- Numeração informada manualmente pelo usuário no FocoMEI (NFS-e/DPS e NF-e).
-- O alocador normalmente nunca desce abaixo do maior número já visto no histórico.
-- Quando o usuário corrige a numeração na tela, o pedido fica aqui e vence o
-- histórico uma única vez: é consumido na primeira emissão e, se a prefeitura/SEFAZ
-- recusar por duplicidade, o retry volta a usar a regra automática.

create table if not exists public.mei_fiscal_numeracao_overrides (
  cnpj text not null,
  document_type text not null,
  next_numero integer not null,
  serie text null,
  requested_by uuid null references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint mei_fiscal_numeracao_overrides_pkey primary key (cnpj, document_type),
  constraint mei_fiscal_numeracao_overrides_document_type_check
    check (document_type in ('nfse', 'nfe')),
  constraint mei_fiscal_numeracao_overrides_next_numero_check
    check (next_numero >= 1)
);

alter table public.mei_fiscal_numeracao_overrides enable row level security;
