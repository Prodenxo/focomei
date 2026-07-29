# OpenClaw FocoMEI — alma + tools

Pacote para o serviço EasyPanel **`openclawfocomei`**.

A **alma (`SOUL.md`) é a do MeiInfinito** (`openclaw-midas-SOUL.md`), portada com marca FocoMEI — mesmo fluxo de NFS-e, DAS, lançamentos e confirmações. Não usar “SOUL enxuto”: corta regras e o bot inventa JSON flat.

## Pré-requisitos (EasyPanel)

### Ambiente do `openclawfocomei`
| Variável | Exemplo |
|----------|---------|
| `MF_API_URL` | `https://auto-focomei-backend.4tnf3f.easypanel.host/api/bot/openclaw/action` |
| `OPENCLAW_WEBHOOK_SECRET` | **igual** ao backend |
| `OPENAI_API_KEY` | chave OpenAI |
| `OPENCLAW_GATEWAY_TOKEN` | token do painel |
| `OPENCLAW_PUBLIC_ORIGIN` | `https://auto-openclawfocomei.4tnf3f.easypanel.host` |
| `OPENCLAW_SOUL_RAW_URL` | URL **Raw** do GitHub de `docs/ops/openclaw-focomei/SOUL.md` (obrigatório para alma completa) |

### Volume
`/home/node/.openclaw` → volume persistente

### Backend
- Redeploy com merge de payload flat + aliases NFSe
- Mesmo `OPENCLAW_WEBHOOK_SECRET`
- Telefone em **`n8n_link`** (DDI 55)

## Instalar (Console)

1. Commit + push de `SOUL.md` → copia URL Raw no GitHub  
2. EasyPanel → env `OPENCLAW_SOUL_RAW_URL` = essa URL  
3. Cola [`install-easypanel-console.sh`](./install-easypanel-console.sh) no Console  
4. Confirma tamanho: `wc -c /home/node/.openclaw/workspace/SOUL.md` → deve ser **~50 KB**, não ~1 KB  
5. Restart OpenClaw  
6. WhatsApp: `/new`

Só o SOUL (se tools já existem):

```bash
curl -fsSL "$OPENCLAW_SOUL_RAW_URL" -o /home/node/.openclaw/workspace/SOUL.md
wc -c /home/node/.openclaw/workspace/SOUL.md
```

`bootstrapMaxChars=65000` (SOUL ~54 KB — senão o OpenClaw corta o fim: regras NF-e/produto e o bot cai em NFS-e).

## Smoke

```bash
/home/node/.openclaw/workspace/mf-curl.sh 5521996185328 '{"action":"ping"}'
/home/node/.openclaw/workspace/mf-curl.sh 5521996185328 '{"action":"resolve_user"}'
/home/node/.openclaw/workspace/mf-curl.sh 5521996185328 '{"action":"preview_nfse","payload":{"tomadorNome":"Leonardo","valor":2,"servicoIndice":1}}'
```

## Regenerar SOUL a partir do MeiInfinito

```bash
node docs/ops/openclaw-focomei/port-soul-from-meiinfinito.mjs
```

## Ficheiros
- `SOUL.md` — alma completa (paridade MeiInfinito)
- `mf-curl.sh`, `mf-das-send.sh`, `mf-nfse-send.sh`
- `IDENTITY.md`, `USER.md`, `MF-API.md`
