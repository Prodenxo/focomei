# Postgres EasyPanel (FocoMEI)

Banco dedicado, **sem Supabase Auth**. Schemas (aplicar nesta ordem):

1. `001_init_schema.sql` — tabelas (`public.users`, financeiro, MEI/fiscal)
2. `002_indexes_triggers.sql` — indexes + triggers
3. `004_nfse_rps_functions.sql` — RPCs RPS NFS-e (**obrigatório** para emissão)
4. `003_seed_categories.sql` — categorias globais
5. `005_seed_codigosservicos.sql` — LC 116 / códigos de serviço
6. `006_das_simples.sql` — tabela PGDAS-D (pode existir; runtime FocoMEI não usa)
7. `007_certificados_empresa_encrypted.sql` — certificado cifrado / empresa
8. `008_certificados_unique_por_usuario.sql` — 1 cert ativo por usuário
9. `008_das_simples_sem_debito.sql` — status `sem_debito`
10. `009_parcelamento_pdfs_unique.sql` — unique parcelamento PDF

## Connection (rede interna EasyPanel)

```env
AUTH_MODE=local
DATABASE_URL=postgres://USER:SENHA@HOST:5432/focomei?sslmode=disable
AUTH_JWT_SECRET=troque-por-um-segredo-longo-e-aleatorio
APP_PRODUCT=focomei
FRONTEND_URL=https://focomei.com.br
CORS_ORIGIN=https://focomei.com.br,https://www.focomei.com.br
```

- Database sugerido: `focomei` (ou `focomei_db`)
- **Não** use o banco do Foco Simples

Não commite a senha. Não cole a URL completa com senha em issues/chat.

## Aplicar schemas (PgWeb / DbGate / psql)

1. Crie o database vazio `focomei`
2. Execute os arquivos na ordem acima
3. Confira:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;
SELECT * FROM public.roles;
SELECT proname FROM pg_proc WHERE proname LIKE 'mei_nfse_%';
```

## Auth local

Com `AUTH_MODE=local`, o backend usa `public.users` + JWT próprio (não `auth.users` do Supabase).

## Superadmin

Após criar o primeiro usuário:

```sql
UPDATE public.profiles SET role = 'superadmin' WHERE id = 'UUID-DO-USER';
```

Garanta `role_x_user_x_empresa.mei = true` e `empresas.max_mei > 0` se o gate MEI exigir.

## Política FocoMEI

- `APP_PRODUCT=focomei` (nunca focosimples)
- Certificado: CNPJ MEI
- Prefixo id_integracao tipicamente `mei-`
- PGDAS-D / DAS Simples: tabela pode existir; não usar em runtime FocoMEI

## Diferenças vs Supabase legado

| Antes | Agora (AUTH local) |
|---|---|
| `auth.users` | `public.users` |
| RLS / `auth.uid()` | Autorização no backend |
| Client browser `.from()` | API + JWT |
