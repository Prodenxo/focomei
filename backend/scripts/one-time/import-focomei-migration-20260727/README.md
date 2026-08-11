# Import MeiInfinito → FocoMEI

Script idempotente para carregar o pacote `focomei-migration-20260727` no Postgres EasyPanel (`AUTH_MODE=local`).

## Path do pacote (default)

```
C:\Users\Usuário\Documents\Dev\Meu Financeiro\Site\backend\scripts\one-time\exports\focomei-migration-20260727
```

Override: `--package=<path>` ou env `FOCOMEI_MIGRATION_PACKAGE`.

## Pré-requisitos

1. Migrations `backend/db/easypanel/001` … `009` aplicadas no Postgres FocoMEI.
2. `MEI_CERT_ENCRYPTION_KEY` no `backend/.env` do FocoMEI (**mesma** do MeiInfinito se for usar PFX legado cifrado).
3. Para `--apply`: `DATABASE_URL` no `.env` (Postgres EasyPanel). Dry-run **não** precisa de DB.

## Dry-run (não grava)

Na pasta `backend/`:

```bash
node scripts/one-time/import-focomei-migration-20260727/import.mjs
```

Valida manifesto vs pastas `empresas/` / `users/` / `secrets/certificates/`, conta linhas, lista plano de insert e gera relatório em `reports/dry-run-*.json`.

## Apply (grava)

1. Descomente/preencha `DATABASE_URL` no `.env`.
2. Rode:

```bash
node scripts/one-time/import-focomei-migration-20260727/import.mjs --apply
```

3. Confira contagens vs `00_manifest.json` e o SQL `smoke-counts.sql`.

## Re-sync MeiInfinito → FocoMEI (atualizar tudo)

Enquanto o time ainda usa o **MeiInfinito**, rode periodicamente para espelhar transações, contas, saldos, NFS-e, DAS, certificados, etc.

### Passo 1 — Exportar do MeiInfinito (Supabase produção)

No `.env` do **backend MeiInfinito** (ou cópia com `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` de produção):

```bash
cd backend
node scripts/one-time/export-focomei-migration.mjs
```

Gera pasta datada, ex.: `backend/scripts/one-time/exports/focomei-migration-20260811/`

### Passo 2 — Dry-run no FocoMEI

```bash
cd backend
node scripts/one-time/import-focomei-migration-20260727/import.mjs --package="C:/caminho/exports/focomei-migration-20260811"
```

### Passo 3 — Apply com `--sync` (UPSERT)

**Obrigatório** `--sync` na reimportação — sem ele, linhas já existentes **não são atualizadas** (`DO NOTHING`).

```bash
node scripts/one-time/import-focomei-migration-20260727/import.mjs --apply --sync --package="C:/caminho/exports/focomei-migration-20260811"
```

- `--sync` atualiza: lançamentos, contas (`saldo_inicial`, etc.), categorias, recorrências, NFS-e, DAS, catálogos MEI, tokens Google, certificados.
- **Não** sobrescreve `password_hash` de quem já tem login no FocoMEI.
- **Não** remove registros apagados no MeiInfinito (só insere/atualiza o que veio no export).

### Passo 4 — Smoke

Rodar `smoke-counts.sql` no PgWeb e comparar `lancamentos_id`, `contas_financeiras`, `mei_nfse` com o manifesto.

### EasyPanel / tunnel

- Se o Postgres só é acessível na rede do painel: rode o script num one-off no mesmo serviço, ou use tunnel SSH/port-forward até `DATABASE_URL`.
- Não commite a URL nem o conteúdo de `secrets/`.

## Ordem de insert

roles → users → profiles → empresas → role_x_user_x_empresa → n8n_link → categorias → contas → recorrências → lançamentos → certificados → nfse* → das* → subscription_lines → google_tokens

## Segurança

- Não loga PFX / passphrase / `MEI_CERT_ENCRYPTION_KEY`.
- Certificados: `pfx_base64` + `passphrase_enc`/`passphrase_iv` (legado).
- Todos os users: `password_reset_required=true` + hash scrypt aleatório (login exige reset).

## Smoke SQL

Ver `smoke-counts.sql` neste diretório.
