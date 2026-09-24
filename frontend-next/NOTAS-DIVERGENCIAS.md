# Divergências encontradas na Visão Geral atual

Levantadas durante a refatoração. **Nenhuma regra financeira foi alterada em silêncio** — os
dois primeiros itens foram portados exatamente como estão hoje; o terceiro foi alterado de forma
consciente e está justificado abaixo.

---

## 1. O resumo soma pendentes, os indicadores principais não

**Preservado como está.**

`Entradas`, `Saídas` e `Saldo nas contas` contam apenas lançamentos com status `pago` ou
`recebido`. Já os seis cartões do resumo (`Saldo do mês`, `Quanto sobrou`, `Gasto por dia`,
`A pagar`, `Lançamentos`, `Gastos vs mês passado`) vêm de `buildDashboardInsights`, que soma
**todos** os status, inclusive `a_pagar` e `a_receber`.

Resultado prático: um mês com R$ 1.000 recebidos e R$ 500 a receber mostra `Entradas R$ 1.000,00`
e `Saldo do mês R$ 1.500,00` (descontando as saídas). Os dois números estão certos dentro da
própria definição, mas parecem contraditórios lado a lado.

- Origem: `frontend/screens/Dashboard/dashboardInsights.ts`
- Porte: `frontend-next/lib/finance/dashboardInsights.js`
- Coberto pelo teste `resumo soma todos os status, inclusive pendentes (divergência preservada)`

**Decisão necessária:** ou o resumo passa a considerar só realizados, ou os rótulos deixam
explícito que ele inclui o previsto. Não dá para resolver isso sem alguém do produto decidir.

---

## 2. "Quanto sobrou" devolve 0% quando não houve receita

**Preservado como está.**

`savingsRate = income > 0 ? (net / income) * 100 : 0`. Num mês só com despesas, o cartão mostra
`0%` com tom neutro — o mesmo visual de um mês sem nenhuma movimentação, ainda que a situação
seja bem diferente.

A comparação com o mês passado tem tratamento parecido: quando o mês anterior não teve nenhuma
despesa, o cartão `Gastos vs mês passado` simplesmente não aparece, em vez de mostrar algo como
"primeiro mês com gastos".

- Origem: `frontend/screens/Dashboard/dashboardInsights.ts`
- Coberto pelos testes `sem receita, "quanto sobrou" vira 0%…` e `comparação com o mês passado some…`

---

## 3. Gráficos da visão BPO liam campos que a API não devolve

**Comportamento alterado — de propósito, e este é o registro.**

A tela antiga monta a série anual assim:

```ts
const valor = typeof row?.valor_orçado === 'number' ? row.valor_orçado : Number(row?.valor_orçado || 0);
if (!row?.date) return;
const monthIndex = Number(String(row.date).split('-')[1]) - 1;
```

Mas `/api/categories/budgets/yearly` devolve `{ categorias_id, valor_orcado, month }` — sem
cedilha em `orcado` e com `month` numérico, não `date`. As duas leituras falham: `valor` fica 0 e
o `return` antecipado descarta todas as linhas. Como o resultado final é filtrado por
`totalBudgeted > 0`, a aba **Gráficos** da visão BPO fica permanentemente vazia, mostrando
"Nenhuma categoria com orçamento" mesmo quando há orçamentos cadastrados.

Na versão nova, `buildBpoCategorySeries` aceita as duas grafias (`valor_orcado` e `valor_orçado`)
e as duas formas de mês (`month` e `date`). Portar o defeito fielmente entregaria uma aba que
nunca funciona.

- Origem: `frontend/screens/DashboardScreen.tsx`, `bpoCategorySeries`
- Porte: `frontend-next/lib/finance/visaoGeral.js`
- Coberto pelo teste `série BPO aceita o formato que a API realmente devolve (month/valor_orcado)`

**Atenção:** com a correção, a aba passa a exibir dados que antes não apareciam. Vale conferir os
números com alguém que conheça os orçamentos reais antes de levar para produção.

---

## 4. `buildDashboardInsights` recebia um parâmetro que não usava

Cosmético, sem efeito em cálculo: a versão TypeScript aceita `categoriasMap` como quarto
argumento e nunca o utiliza. No porte o parâmetro foi removido da assinatura.

---

## 5. Contratos fiscais do Foco Simples não foram copiados

O módulo fiscal usa somente os contratos existentes no Foco MEI:

- DAS: `/mei-guide/*`, com consulta, geração, atualização de guia vencida e download.
- Notas e catálogos: `/mei-notas/*`.
- Operação interestadual: consulta e aceite do termo em `/mei-notas/interestadual/*`.

As rotas exclusivas do Foco Simples (`/simples-das/*`, `/accountant/*`, configuração de cenários
tributários e sincronização manual inexistente do certificado) foram removidas. O upload de
certificado continua usando a integração já executada pelo backend do Foco MEI.

## 6. Solicitações administrativas têm fallback para a Edge Function

O backend local atual não publica `/admin/access-requests/*`. A tela tenta esse contrato primeiro
e, ao receber 404, usa a Edge Function `manage-access-requests`, como o frontend Expo. Para esse
fallback funcionar, o ambiente web precisa fornecer `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, e a sessão Supabase precisa existir no navegador.

## 7. Corte definitivo do Expo

O fallback para `localhost:8081` foi removido do `next.config.mjs`. Todas as rotas funcionais
listadas na navegação, autenticação, ativação, contrato, conta e módulo fiscal agora são atendidas
diretamente pelo Next.js. `/visao-geral`, `/mei` e `/configuracoes` permanecem somente como
redirecionamentos de compatibilidade para as novas rotas.
