# Objetivo do monorepo (Foco MEI × meiinfinito)

**Produto = features do meiinfinito + features novas do Foco MEI**  
**Visual = design do Foco MEI**  
**Repo original do meiinfinito = intocado** (esta pasta é cópia)

## Canônico neste repo

| Peça | Onde |
|------|------|
| App Expo (design Foco MEI + finanças + MEI) | `App/frontend` — **principal** |
| Cópia Vite meiinfinito | `apps/meiinfinito/frontend` — referência |
| Backend unificado | `site/backend` |
| Design system Foco MEI | `App/frontend/lib/theme.ts`, UI tech |

Finanças pessoais restauradas no Expo a partir de `Documents/Dev/Meu Financeiro/App/frontend` (telas + nav). Home = Dashboard; Meu MEI em `/(app)/mei`.

## Não fazer

- Não manter dois produtos separados no dia a dia
- Não deployar esta cópia no `meiinfinito.com.br` sem decisão explícita
- Não sobrescrever o repo original em `Documents/Dev/Meu-financeiro`
