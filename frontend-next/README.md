# frontend-next — Visão Geral em Next.js

Aplicação Next.js (App Router, JavaScript/JSX) que hoje contém **só a Visão Geral**. O app Expo em
`frontend/` continua intacto e responde por todas as outras telas, inclusive o login.

## Como rodar

```bash
cp .env.example .env.local   # ajuste as URLs se precisar
npm install
npm run dev                  # http://localhost:3001/visao-geral
```

Para ver dados reais é preciso ter, ao mesmo tempo:

1. O backend rodando (`NEXT_PUBLIC_MEI_API_URL`, padrão `http://localhost:3333`).
2. O app Expo rodando (`NEXT_PUBLIC_LEGACY_WEB_URL`, padrão `http://localhost:8081`).
3. **Login feito no app Expo, no mesmo navegador.**

## Sessão compartilhada

Não há login aqui. O app Expo grava a sessão no `localStorage` (no web, o AsyncStorage é o próprio
`localStorage`) e esta tela lê as mesmas chaves:

| Chave | Modo |
|---|---|
| `focomei-local-auth` | autenticação local via API |
| `financas-pessoais-auth` | Supabase |

Sem sessão válida, a página redireciona para `/login` do app antigo em vez de mostrar zeros. O
token do navegador é revalidado em `GET /api/auth/session` para pegar `role` e `mei` atualizados.

Como as duas aplicações rodam em portas diferentes, `localhost:3001` e `localhost:8081` têm
`localStorage` separados. Para desenvolver com dados reais, abra o app Expo pela porta 8081,
faça login, e copie as chaves acima para a origem 3001 pelo console do navegador — ou sirva as
duas atrás do mesmo host.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento na porta 3001 |
| `npm run build` | build de produção |
| `npm run lint` | ESLint (`next/core-web-vitals`) |
| `npm test` | testes das funções financeiras (`node:test`) |

## Organização

```
app/visao-geral/          rota da tela
components/ui/            compartilhados: nav, botões, cards, filtros, estados
components/visao-geral/   blocos da tela
components/tema/          claro / escuro / automático (mesma chave do app antigo)
lib/finance/              porte fiel dos cálculos financeiros
lib/api.js                porte do apiClient (Bearer + contrato { success, data, message })
lib/session.js            leitura da sessão do navegador
services/visaoGeral.js    chamadas de API da tela
styles/tokens.css         cores, tipografia, espaçamento, raios e sombras
tests/                    paridade dos cálculos
```

## Regras financeiras

Os cálculos foram portados linha a linha de `frontend/lib/` e
`frontend/screens/Dashboard/`. As diferenças encontradas entre os próprios indicadores atuais
estão registradas em [`NOTAS-DIVERGENCIAS.md`](./NOTAS-DIVERGENCIAS.md) — nenhuma foi alterada em
silêncio.
