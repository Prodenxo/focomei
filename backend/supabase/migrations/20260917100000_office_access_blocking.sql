-- Suspensão de escritórios sem alterar vínculos ou excluir dados.
alter table public.empresas
  add column if not exists access_status text not null default 'active',
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_by uuid,
  add column if not exists blocked_reason text;

update public.empresas
set access_status = 'active'
where access_status is null
   or access_status not in ('active', 'blocked');

alter table public.empresas
  drop constraint if exists empresas_access_status_check;

alter table public.empresas
  add constraint empresas_access_status_check
  check (access_status in ('active', 'blocked'));

create index if not exists idx_empresas_access_status
  on public.empresas (access_status);

create table if not exists public.access_block_audit (
  id bigserial primary key,
  target_type text not null check (target_type in ('empresa', 'usuario')),
  target_id uuid not null,
  actor_user_id uuid not null,
  previous_status text not null,
  new_status text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_access_block_audit_target
  on public.access_block_audit (target_type, target_id, created_at desc);

create index if not exists idx_access_block_audit_actor
  on public.access_block_audit (actor_user_id, created_at desc);

alter table public.access_block_audit enable row level security;

comment on column public.empresas.access_status is
  'Suspensão operacional do escritório. Não altera status dos vínculos de usuários.';

comment on table public.access_block_audit is
  'Auditoria imutável de bloqueios e desbloqueios de escritórios e usuários.';

-- O token pode continuar criptograficamente válido após um bloqueio. Estas
-- funções tornam o estado atual do banco autoritativo também para RLS e RPCs.
create or replace function public.current_access_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      (select p.role = 'superadmin' from public.profiles p where p.id = auth.uid()),
      false
    )
    or exists (
      select 1
      from public.role_x_user_x_empresa rx
      left join public.empresas e on e.id = rx.empresas_id
      where rx.user_id = auth.uid()
        and coalesce(rx.status, true) = true
        and (rx.expires_at is null or rx.expires_at > now())
        and (rx.empresas_id is null or coalesce(e.access_status, 'active') = 'active')
    );
$$;

create or replace function public.target_user_access_allowed(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      (select p.role = 'superadmin' from public.profiles p where p.id = target_user_id),
      false
    )
    or exists (
      select 1
      from public.role_x_user_x_empresa rx
      left join public.empresas e on e.id = rx.empresas_id
      where rx.user_id = target_user_id
        and coalesce(rx.status, true) = true
        and (rx.expires_at is null or rx.expires_at > now())
        and (rx.empresas_id is null or coalesce(e.access_status, 'active') = 'active')
    );
$$;

create or replace function public.current_access_denial_code()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.current_access_allowed() then null
    when exists (
      select 1
      from public.role_x_user_x_empresa rx
      where rx.user_id = auth.uid()
        and coalesce(rx.status, true) = true
        and (rx.expires_at is null or rx.expires_at > now())
    ) then 'OFFICE_BLOCKED'
    else 'PROFILE_BLOCKED'
  end;
$$;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select 'superadmin' from public.profiles p
      where p.id = auth.uid() and p.role = 'superadmin'),
    (
      select lower(r.roles)
      from public.role_x_user_x_empresa rx
      join public.roles r on r.id = rx.roles_id
      left join public.empresas e on e.id = rx.empresas_id
      where rx.user_id = auth.uid()
        and coalesce(rx.status, true) = true
        and (rx.expires_at is null or rx.expires_at > now())
        and (rx.empresas_id is null or coalesce(e.access_status, 'active') = 'active')
      order by rx.created_at desc
      limit 1
    )
  );
$$;

create or replace function public.current_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select rx.empresas_id
  from public.role_x_user_x_empresa rx
  join public.empresas e on e.id = rx.empresas_id
  where rx.user_id = auth.uid()
    and coalesce(rx.status, true) = true
    and (rx.expires_at is null or rx.expires_at > now())
    and coalesce(e.access_status, 'active') = 'active'
  order by rx.created_at desc
  limit 1;
$$;

create or replace function public.admin_can_view_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_access_allowed()
    and public.target_user_access_allowed(target_user_id)
    and case
      when public.current_app_role() = 'superadmin' then true
      when public.current_app_role() = 'admin' then exists (
        select 1
        from public.role_x_user_x_empresa rx
        where rx.user_id = target_user_id
          and rx.empresas_id = public.current_empresa_id()
      )
      else false
    end;
$$;

-- Fecha a escalada cross-tenant da policy antiga de INSERT de vínculos.
drop policy if exists "role_link_insert_admin" on public.role_x_user_x_empresa;
create policy "role_link_insert_admin"
on public.role_x_user_x_empresa
for insert
with check (
  public.current_app_role() = 'superadmin'
  or (
    public.current_app_role() = 'admin'
    and empresas_id = public.current_empresa_id()
  )
);

-- Admin vê somente perfis do próprio escritório; superadmin mantém visão global.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
using (
  id = auth.uid()
  or public.current_app_role() = 'superadmin'
  or (
    public.current_app_role() = 'admin'
    and public.admin_can_view_user(id)
  )
);

-- Políticas restritivas são combinadas com as policies funcionais existentes:
-- mesmo uma policy antiga de "self" não libera uma conta/escritório suspenso.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'lancamentos_id',
    'categorias_id',
    'mei_nfse',
    'user_mei_certificates',
    'google_tokens_id',
    'google_tokens',
    'recorrencias',
    'contas_financeiras'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format(
        'drop policy if exists "access_status_guard" on public.%I',
        table_name
      );
      execute format(
        'create policy "access_status_guard" on public.%I as restrictive for all to authenticated using (public.current_access_allowed()) with check (public.current_access_allowed())',
        table_name
      );
    end if;
  end loop;
end;
$$;

grant execute on function public.current_access_allowed() to authenticated;
grant execute on function public.current_access_denial_code() to authenticated;
grant execute on function public.target_user_access_allowed(uuid) to authenticated;
