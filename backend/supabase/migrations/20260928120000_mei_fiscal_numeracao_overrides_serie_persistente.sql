-- A série escolhida pelo usuário precisa continuar valendo depois que o número
-- manual é consumido na primeira emissão. Antes o registro inteiro era apagado e a
-- próxima nota voltava para a série do cadastro do emissor (normalmente 1),
-- batendo em numeração já usada. Agora `next_numero` fica nulo e a série permanece.

alter table public.mei_fiscal_numeracao_overrides
  alter column next_numero drop not null;

alter table public.mei_fiscal_numeracao_overrides
  drop constraint if exists mei_fiscal_numeracao_overrides_next_numero_check;

alter table public.mei_fiscal_numeracao_overrides
  add constraint mei_fiscal_numeracao_overrides_next_numero_check
    check (next_numero is null or next_numero >= 1);
