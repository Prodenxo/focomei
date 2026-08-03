# Deploy — Método MEI Lucrativo (EasyPanel)

Landing do workshop em Next.js (`metodo-mei-lucrativo-codigo-fonte`).

**URL pública:** `https://workshop.focomei.com.br/`

Build **Next.js standalone** (Node 22). Porta **3000**.

---

## Pré-requisitos

- [ ] DNS **A** ou **CNAME** de `workshop.focomei.com.br` → IP/host do EasyPanel
- [ ] Código no Git (`Prodenxo/focomei`, branch `main`)

---

## 1. Criar serviço no EasyPanel

1. **Create Service → App**
2. Nome sugerido: `focomei-workshop`
3. **Fonte → GitHub**
   - Repositório: `Prodenxo/focomei`
   - Ramo: `main`
   - **Caminho de Build:** `metodo-mei-lucrativo-codigo-fonte`
4. **Construção → Dockerfile**
5. **Porta:** `3000`
6. **Domínio:** `workshop.focomei.com.br` (só o host, sem path)
7. Ative **HTTPS**
8. **Implantar**

---

## 2. Variáveis de ambiente

Nenhuma obrigatória.

| Variável | Valor |
|---|---|
| `PORT` | `3000` |
| `NODE_ENV` | `production` |

---

## 3. DNS (cPanel ou Cloudflare)

Registro **A**:

```
workshop.focomei.com.br → IP do EasyPanel (ex.: 178.156.236.94)
```

Ou **CNAME** apontando para o host que o EasyPanel fornecer.

---

## 4. Checklist pós-deploy

- [ ] `https://workshop.focomei.com.br/` abre a landing
- [ ] HTTPS ok
- [ ] Título: **Método MEI Lucrativo para Contadores**
- [ ] Botão WhatsApp abre o grupo
- [ ] Mobile ok

---

## 5. Build local (opcional)

```bash
cd metodo-mei-lucrativo-codigo-fonte
npm ci
npm run build:easypanel
npm run start:easypanel
```

Abra `http://localhost:3000/`.
