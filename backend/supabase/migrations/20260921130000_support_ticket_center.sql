-- Story 1.1 — vínculos locais e notificações da central ScrumHub.

create table if not exists public.support_ticket_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  empresa_id uuid null references public.empresas (id) on delete set null,
  scrumhub_ticket_id bigint not null,
  codigo text null,
  nome text not null,
  prioridade text null,
  status_id bigint null,
  status_nome text null,
  concluido boolean not null default false,
  aprovado boolean not null default false,
  public_url text null,
  requester_email text not null,
  requester_phone text null,
  requester_name text null,
  last_timeline_fingerprint text null,
  known_remote_event_keys jsonb not null default '[]'::jsonb,
  last_remote_update_at timestamptz null,
  last_synced_at timestamptz null,
  import_source text not null default 'create',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_ticket_links_ticket_key unique (scrumhub_ticket_id),
  constraint support_ticket_links_import_source_check
    check (import_source in ('create', 'legacy_import'))
);

alter table public.support_ticket_links
  add column if not exists known_remote_event_keys jsonb not null default '[]'::jsonb;

create index if not exists support_ticket_links_user_updated_idx
  on public.support_ticket_links (user_id, updated_at desc);

create index if not exists support_ticket_links_open_sync_idx
  on public.support_ticket_links (concluido, last_synced_at)
  where concluido = false;

create table if not exists public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_link_id uuid not null references public.support_ticket_links (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  event_key text not null,
  event_type text not null,
  title text not null,
  message text not null,
  remote_comment_id text null,
  remote_created_at timestamptz null,
  read_at timestamptz null,
  whatsapp_sent_at timestamptz null,
  whatsapp_attempts integer not null default 0,
  whatsapp_error text null,
  created_at timestamptz not null default now(),
  constraint support_ticket_events_key unique (ticket_link_id, event_key),
  constraint support_ticket_events_type_check
    check (event_type in ('comment', 'completed'))
);

create index if not exists support_ticket_events_user_unread_idx
  on public.support_ticket_events (user_id, created_at desc)
  where read_at is null;

create index if not exists support_ticket_events_whatsapp_pending_idx
  on public.support_ticket_events (created_at)
  where whatsapp_sent_at is null and whatsapp_attempts < 3;

create table if not exists public.support_ticket_import_state (
  user_id uuid primary key references public.users (id) on delete cascade,
  imported_at timestamptz not null default now()
);

create or replace function public.set_support_ticket_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_support_ticket_links_updated_at on public.support_ticket_links;
create trigger trg_support_ticket_links_updated_at
before update on public.support_ticket_links
for each row execute function public.set_support_ticket_updated_at();
