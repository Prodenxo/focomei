-- Evita repetir o aviso de vencimento do mesmo certificado para o mesmo responsável.
create table if not exists public.certificate_expiration_notifications (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null
    references public.user_mei_certificates (id) on delete cascade,
  recipient_user_id uuid not null,
  cert_valid_to timestamptz not null,
  phone text,
  channel text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (certificate_id, recipient_user_id, cert_valid_to)
);

create index if not exists idx_certificate_expiration_notifications_recipient
  on public.certificate_expiration_notifications (recipient_user_id, sent_at desc);

alter table public.certificate_expiration_notifications enable row level security;

comment on table public.certificate_expiration_notifications is
  'Avisos de WhatsApp já enviados aos responsáveis por certificados MEI próximos do vencimento.';
