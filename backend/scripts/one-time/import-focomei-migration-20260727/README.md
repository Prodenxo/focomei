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
