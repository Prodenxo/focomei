-- Respostas publicadas pela equipe FocoMEI no ScrumHub.
-- A API pública só cria comentários externos (`nome_externo`), então o autor real
-- fica registrado aqui para a conversa mostrar o lado correto ao solicitante.

create table if not exists public.support_ticket_agent_replies (
  id uuid primary key default gen_random_uuid(),
  scrumhub_ticket_id bigint not null,
  remote_comment_id text not null,
  agent_user_id uuid null references public.users (id) on delete set null,
    10|  agent_name text not null,
  created_at timestamptz not null default now(),
  constraint support_ticket_agent_replies_key unique (scrumhub_ticket_id, remote_comment_id)
);

create index if not exists support_ticket_agent_replies_ticket_idx
  on public.support_ticket_agent_replies (scrumhub_ticket_id);
