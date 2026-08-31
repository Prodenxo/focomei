# OpenClaw — conectar e liberar dispositivo

**FocoMEI** · fluxo sem token no Easypanel Environment

O token fica **dentro do container** (`openclaw.json`). Quem opera copia de lá e cola no painel.

---

## URLs

| O quê | Onde |
|-------|------|
| Painel OpenClaw | `https://auto-openclawfocomei.4tnf3f.easypanel.host` |
| Console (comandos) | Easypanel → serviço **openclawfocomei** → **Console** |
| Serviço | Precisa estar **Running** (verde) |

---

## Fluxo completo (resumo)

```
Browser: abrir painel → clicar Conectar → colar token
Console: consultar token → (se pedido) gerar token → listar dispositivo → aprovar
Browser: recarregar → conectado
```

---

## Passo 1 — Abrir o painel no browser

1. Abra: `https://auto-openclawfocomei.4tnf3f.easypanel.host`
2. Vá em **Settings** (Configurações) → **Connection** (Conexão)
3. Clique em **Connect** / **Conectar**

O painel vai pedir o **Gateway Token**. **Ainda não cole nada** — vá ao console primeiro.

---

## Passo 2 — Consultar o token (Console do Easypanel)

Easypanel → **openclawfocomei** → **Console** (só com serviço Running).

### 2a) Ver se o gateway está de pé

```bash
openclaw gateway status --deep
```

Esperado: gateway **running**, porta **18789**.

Se falhar:

```bash
openclaw gateway probe
```

---

### 2b) Consultar o token já existente

```bash
openclaw gateway auth-token --show
```

Copie o token que aparecer (string longa). **Não compartilhe** em chat/e-mail.

**Alternativa** — ler direto do arquivo:

```bash
openclaw config get gateway.auth
```

Ou:

```bash
node -e "const c=require('/home/node/.openclaw/openclaw.json'); console.log(c.gateway?.auth?.token||'SEM TOKEN')"
```

---

### 2c) Se não existir token — gerar (primeira vez)

Se `auth-token --show` disser que não há token configurado:

```bash
openclaw doctor --generate-gateway-token
```

Depois **Restart** do serviço no Easypanel (botão Deploy/Restart — **não** use `openclaw gateway restart` no console).

Aguarde ~30 s e consulte de novo:

```bash
openclaw gateway auth-token --show
```

Copie o token.

---

## Passo 3 — Colar o token e conectar (browser)

1. Volte ao painel OpenClaw no browser
2. **Settings → Connection**
3. Cole o token copiado do console
4. Clique **Connect** / **Conectar**

---

## Passo 4 — Liberar o dispositivo (pairing)

Se após conectar aparecer:

```text
disconnected (1008): pairing required
```

Isso é **normal** na primeira vez. O token está certo; falta **aprovar o browser**.

### Opção A — comando recomendado (Console)

```bash
openclaw dashboard
```

Gera um link de pairing. Se o console não abrir browser, use a Opção B.

### Opção B — aprovar manualmente (Console)

**1) Listar pedidos pendentes:**

```bash
openclaw devices list
```

Saída exemplo (o seu `requestId` será diferente):

```text
Pending pairing requests:
  requestId: abc123-def456-...
  client: browser
  ...
```

**2) Copie o `requestId` e aprove:**

```bash
openclaw devices approve abc123-def456-...
```

Troque `abc123-def456-...` pelo ID real do passo anterior.

**3) Ver só o pedido mais recente (preview):**

```bash
openclaw devices approve --latest
```

Esse comando **só mostra** o ID e sai com erro — copie o ID e rode de novo:

```bash
openclaw devices approve REQUEST_ID_COPIADO
```

**4) Volte ao browser e recarregue a página** (F5).

Deve conectar sem o erro 1008.

---

## Passo 5 — Confirmar que ficou liberado

No console:

```bash
openclaw devices list
```

O dispositivo deve aparecer em **Paired devices** (não mais em Pending).

No browser: **Settings → Connection** → status **Connected**.

---

## Comandos úteis (referência)

| Comando | Para quê |
|---------|----------|
| `openclaw gateway status --deep` | Ver se o gateway está rodando |
| `openclaw gateway probe` | Testar conexão |
| `openclaw gateway auth-token --show` | **Consultar token** para colar no painel |
| `openclaw doctor --generate-gateway-token` | **Gerar token** (primeira vez) |
| `openclaw config get gateway.auth` | Ver config de auth (token pode vir redacted) |
| `openclaw devices list` | Ver dispositivos pendentes e já pareados |
| `openclaw devices approve <requestId>` | **Liberar** o browser/dispositivo |
| `openclaw devices approve --latest` | Preview do pedido mais recente |
| `openclaw devices reject <requestId>` | Recusar um pedido |
| `openclaw devices remove <deviceId>` | Remover dispositivo pareado |
| `openclaw dashboard` | Link rápido de pairing |
| `openclaw logs --follow` | Ver erros de auth/pairing ao vivo |

---

## Problemas comuns

| Erro | O que fazer |
|------|-------------|
| `gateway token missing` / unauthorized | Console → `openclaw gateway auth-token --show` → colar no painel |
| `1008: pairing required` | Console → `openclaw devices list` → `openclaw devices approve <id>` |
| Token não aparece | `openclaw doctor --generate-gateway-token` → **Restart** Easypanel → consultar de novo |
| Pedido sumiu ao aprovar | Rode `devices list` de novo — o ID muda se o browser tentou reconectar |
| Pede pairing toda vez | Não use aba anônima; não limpe cookies do site |
| `origin not allowed` | Easypanel → `OPENCLAW_PUBLIC_ORIGIN` = URL exata do browser → Restart |

---

## Importante

- **Não** é necessário colocar token em **Environment** do Easypanel (`OPENCLAW_GATEWAY_TOKEN`). O token vive em `/home/node/.openclaw/openclaw.json` no volume.
- **Restart** do serviço: sempre pelo **Easypanel**, não `openclaw gateway restart` no console.
- Cada browser/perfil novo = novo pairing (passo 4 de novo).
