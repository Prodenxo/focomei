# Deploy — FocoMEI Contadores (EasyPanel)

Landing comercial em Next.js (`focomei-contadores-codigo-fonte`).

**URL pública:** `https://contadores.focomei.com.br/lp`  
(`basePath: /lp` no Next.js; `/` redireciona para `/lp`)

Usa build **Next.js standalone** (Node 22), sem Vinext/Cloudflare. Porta **3000**.

---

## Pré-requisitos

- [ ] DNS **A** de `contadores.focomei.com.br` → IP do EasyPanel (ex.: `178.156.236.94`)
- [ ] Código desta pasta no repositório Git conectado ao EasyPanel
- [ ] Node no Dockerfile já definido (`node:22-bookworm-slim`)

---

## 1. Fonte no EasyPanel (importante)

**Não** use a aba **Imagem Docker** (campo `nome:tag`) a menos que você já tenha publicado uma imagem.

Use uma destas:

### Opção recomendada — Git + Dockerfile

1. Aba **Fonte** → **Git** (ou “Dockerfile” / “App” com repositório)
2. Repositório do monorepo FOCOMEI
3. **Build context:** `focomei-contadores-codigo-fonte`
4. **Dockerfile:** `focomei-contadores-codigo-fonte/Dockerfile` (ou `Dockerfile` se o contexto já for essa pasta)
5. **Port:** `3000`

### Domínio

1. Aba **Domains** / **Domínios** do serviço `focomei-contadoreslp`
2. Host: `contadores.focomei.com.br` (sem `/lp` no campo de domínio)
3. Ative **HTTPS**
4. A landing responde em **`/lp`** (isso é do Next, não do campo de domínio)

Não coloque `contadores.focomei.com.br/lp` como “domínio” — o EasyPanel espera só o host; o path `/lp` vem do app.

---

## 2. Variáveis de ambiente

Nenhuma obrigatória.

| Variável | Valor sugerido |
|----------|----------------|
| `PORT` | `3000` |
| `NODE_ENV` | `production` |

---

## 3. Build local (opcional)

```bash
cd focomei-contadores-codigo-fonte
npm ci
npm run build:easypanel
npm run start:easypanel
```

Abra `http://localhost:3000/lp` (não a raiz).

---

## 4. Checklist pós-deploy

- [ ] `https://contadores.focomei.com.br/lp` abre a landing
- [ ] `https://contadores.focomei.com.br/` redireciona para `/lp`
- [ ] HTTPS ok
- [ ] Título: **FocoMEI Contadores**
- [ ] CTA e-mail funciona
- [ ] Mobile ok

---

## 5. Troubleshooting

| Sintoma | Ação |
|---------|------|
| Tela “Imagem Docker” vazia | Troque para fonte **Git + Dockerfile** |
| `/lp` 404 | Confirme redeploy após `basePath: "/lp"` e porta 3000 |
| Domínio 502 | Porta do serviço = **3000**; HTTPS no domínio |
| Raiz `/` sem redirect | Redeploy com `next.config.ts` atual (redirect `/` → `/lp`) |
