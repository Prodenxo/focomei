-- Self-serve: contrato antes do pagamento (sem Stripe) + link de assinatura

alter table public.empresa_mei_subscription_lines
  add column if not exists contrato_signing_url text,
  add column if not exists contrato_onety_id bigint,
  add column if not exists onety_funil_id integer,
  add column if not exists onety_lead_id bigint,
  add column if not exists contrato_client_signed_at timestamptz;

alter table public.empresa_mei_subscription_lines
  drop constraint if exists empresa_mei_subscription_lines_contrato_status_check;

alter table public.empresa_mei_subscription_lines
  add constraint empresa_mei_subscription_lines_contrato_status_check
    check (
      contrato_status is null
      or contrato_status in (
        'pending',
        'sent',
        'failed',
        'skipped',
        'awaiting_signature',
        'client_signed',
        'fully_signed'
      )
    );

create index if not exists empresa_mei_subscription_lines_onety_lead_idx
  on public.empresa_mei_subscription_lines (onety_lead_id)
  where onety_lead_id is not null;
