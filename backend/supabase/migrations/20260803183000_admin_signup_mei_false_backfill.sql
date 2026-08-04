-- Admins self-serve não devem nascer com vaga MEI (mei=true era default legado).
alter table public.role_x_user_x_empresa
  alter column mei set default false;

update public.role_x_user_x_empresa
set mei = false
where mei is null;

-- Admin sem plano MEI pago: trata como PF/Outros até pagamento ou liberação manual.
update public.role_x_user_x_empresa rx
set mei = false
from public.roles r,
     public.empresas e
where rx.roles_id = r.id
  and rx.empresas_id = e.id
  and lower(trim(r.roles)) = 'admin'
  and coalesce(rx.status, true) = true
  and rx.mei is true
  and coalesce(e.max_mei, 0) <= 0
  and not exists (
    select 1
    from public.empresa_mei_subscription_lines l
    where l.empresa_id = e.id
      and l.status = 'active'
  );
