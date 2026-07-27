# Deploy — FocoMEI Contadores (EasyPanel)

Landing comercial em Next.js (`focomei-contadores-codigo-fonte`), domínio
**`contadores.focomei.com.br`**.

Usa build **Next.js standalone** (Node 22), sem Vinext/Cloudflare. Porta **3000**.

---

## Pré-requisitos

- [ ] DNS **A** de `contadores.focomei.com.br` → IP do EasyPanel (ex.: `178.156.236.94`)
- [ ] Código desta pasta no repositório Git conectado ao EasyPanel
- [ ] Node no Dockerfile já definido (`node:22-bookworm-slim`); não precisa instalar Node no host

---

## 1. Criar o App no EasyPanel

1. **Create Service → App**
2. **Nome:** `focomei-contadores` (ou similar)
3. **Source:** GitHub / Git — mesmo monorepo FOCOMEI (ou repo só desta pasta)
4. **Build**
   - Type: **Dockerfile**
   - Dockerfile path: `focomei-contadores-codigo-fonte/Dockerfile` (monorepo) **ou** `Dockerfile` se o contexto for só esta pasta
   - **Build context:** pasta `focomei-contadores-codigo-fonte`
5. **Port:** `3000`
6. **Domains:** `contadores.focomei.com.br` — ative **HTTPS** (Let's Encrypt)

---

## 2. Variáveis de ambiente

Nenhuma variável obrigatória para a landing estática/marketing.

Opcionais (já usadas pelo runtime Next):

| Variável | Valor sugerido | Notas |
|----------|----------------|--------|
| `PORT` | `3000` | EasyPanel costuma injetar; o Dockerfile já define |
| `NODE_ENV` | `production` | Definido na imagem |

Não é necessário Supabase, API MEI nem secrets para o go-live desta página.

---

## 3. Build local (opcional, espelha o Docker)

Na pasta `focomei-contadores-codigo-fonte`:

```bash
npm ci
npm run build:easypanel
npm run start:easypanel
```

Abra `http://localhost:3000` e valide desktop/mobile.

---

## 4. Checklist pós-deploy

- [ ] `https://contadores.focomei.com.br` abre a landing
- [ ] HTTPS válido (cadeado / certificado EasyPanel)
- [ ] Título da aba: **FocoMEI Contadores**
- [ ] CTA do e-mail (`contato@cfsolucoesempresariais.com.br`) funciona
- [ ] Layout ok em celular (nav colapsa, hero e calculadora legíveis)
- [ ] Redeploy após cada push relevante neste diretório

---

## 5. Notas DNS

O registro **A** de `contadores` já pode apontar para o IP do painel. Se a página não resolver:

1. Confirme o domínio no App EasyPanel
2. Aguarde propagação DNS (minutos a algumas horas)
3. Não altere outros registros de `focomei.com.br` sem necessidade

---

## 6. O que este deploy **não** usa

| Item | Motivo |
|------|--------|
| Vinext / `npm run build` (bash + timeout) | Fluxo Cloudflare/Sites; EasyPanel usa `build:easypanel` |
| `.openai/hosting.json` / D1 / R2 | Só para Sites/Vinext; landing não depende |
| Porta 80 / nginx | App Node standalone na **3000**; EasyPanel faz proxy + TLS |

---

## 7. Troubleshooting rápido

| Sintoma | Ação |
|---------|------|
| Build falha em `next build` | Confirme build context = pasta desta landing e Node 22 na imagem |
| App sobe mas domínio 502 | Porta do serviço = **3000**; HTTPS ligado no domínio |
| Fonte Geist falha no build | Imagem precisa de rede na build (download `next/font`); `ca-certificates` já está no Dockerfile |
