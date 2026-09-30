-- CNPJ do escritório de contabilidade do MEI.
-- Vai no grupo de autorizados a acessar o XML da NF-e (autXML). Alguns estados
-- (ex.: Bahia) exigem esse grupo; sem contador o sistema usa o CNPJ da SEFAZ do estado.
alter table public.user_mei_certificates
  add column if not exists contador_cnpj text;

comment on column public.user_mei_certificates.contador_cnpj is
  'CNPJ do contador (14 dígitos) informado no grupo de autorizados da NF-e. Nulo = usar o padrão do estado.';
