# Foco MEI Web

Frontend oficial do Foco MEI em Next.js App Router.

## Desenvolvimento

```bash
npm ci
npm run dev
```

Abra [http://localhost:3001](http://localhost:3001). O backend local deve estar
em `http://localhost:3333`, salvo configuração diferente em `.env.local`.

## Qualidade

```bash
npm run lint
npm run test
npm run typecheck
```

## Easypanel

Configure o serviço com:

- caminho de build: `/` (raiz do repositório)
- construção: Dockerfile, campo Arquivo vazio (usa o `Dockerfile` da raiz, que aponta para `frontend-next/`)
- porta interna: `3000`
- health check: `/`
- `NEXT_PUBLIC_API_URL=https://auto-focomei-backend.4tnf3f.easypanel.host` (sem `/api` no final)
- `NEXT_PUBLIC_APP_PRODUCT=focomei`

O site antigo em Expo continua construível pelo `Dockerfile.expo` da raiz, na
porta `80`, caso seja preciso reverter.

O container usa o build standalone do Next. O `docker-entrypoint.sh` cria
`public/env-config.js` na inicialização, portanto a URL da API pode ser alterada
no Easypanel sem reconstruir a imagem.

Durante o corte, o serviço Expo anterior deve permanecer disponível sem tráfego
para rollback. O domínio `focomei.com.br` só deve ser movido depois dos smoke
tests no serviço Next.

Variáveis antigas `EXPO_PUBLIC_MEI_API_URL`, `EXPO_PUBLIC_APP_PRODUCT` e
`VITE_API_URL` continuam aceitas temporariamente pelo entrypoint.
