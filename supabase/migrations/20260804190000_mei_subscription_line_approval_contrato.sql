-- Rastreio de aprovação (PIX/cartão) e status do contrato Onety por linha MEI

alter table public.empresa_mei_subscription_lines
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.users (id) on delete set null,
  add column if not exists contrato_status text
    constraint empresa_mei_subscription_lines_contrato_status_check
      check (contrato_status is null or contrato_status in ('pending', 'sent', 'failed', 'skipped')),
  add column if not exists contrato_sent_at timestamptz,
  add column if not exists contrato_error text;

create index if not exists empresa_mei_subscription_lines_billing_type_idx
  on public.empresa_mei_subscription_lines (billing_type, status);

create index if not exists empresa_mei_subscription_lines_contrato_status_idx
  on public.empresa_mei_subscription_lines (contrato_status)
  where contrato_status is not null;
