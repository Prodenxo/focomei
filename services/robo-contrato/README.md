# Robô Contrato FocoMEI → Onety

Recebe POST do backend FocoMEI após pagamento Stripe e gera contrato no Onety/Autentique.

## Deploy no EasyPanel (passo a passo)

### 1. Criar o app

1. EasyPanel → **Create Service** → **App**
2. Fonte: **GitHub** (repo FOCOMEI)
3. **Build path / Root directory:** `services/robo-contrato`
4. **Dockerfile:** `Dockerfile` (dentro dessa pasta)
5. **Porta interna:** `8787`
6. Nome sugerido do serviço: `robo-contrato`

### 2. Variáveis de ambiente (app robo-contrato)

| Variável | Valor |
|---|---|
| `API_URL` | `https://back.cfonety.com.br` |
| `EMAIL` | login Onety |
| `SENHA` | senha Onety |
| `EMPRESA_ID` | `785` |
| `WEBHOOK_SECRET` | token forte (anote) |
| `WEBHOOK_HOST` | `0.0.0.0` |
| `WEBHOOK_PORT` | `8787` |
| `ONETY_AUTO_ENVIAR_WHATSAPP` | `true` — envia link após criar contrato |
| `ONETY_WHATSAPP_INSTANCIA_ID` | ID da instância Z-API (Atendimento → Comercial Foco MEI) |
| `ONETY_WHATSAPP_INSTANCIA_NOME` | Fallback por nome se ID vazio |

Copie de `.env.example` — **não commite senhas**.

### 3. Variáveis no backend FocoMEI (app que já existe)

| Variável | Valor |
|---|---|
| `ONETY_CONTRATO_WEBHOOK_URL` | `http://robo-contrato:8787/webhook/contrato` |
| `ONETY_CONTRATO_WEBHOOK_SECRET` | **mesmo** `WEBHOOK_SECRET` do passo 2 |

> `robo-contrato` = nome do serviço no EasyPanel. Se usar outro nome, troque na URL.

Redeploy **nos dois** apps.

### 4. Testar

Health (pelo domínio público do app, se expuser, ou logs):

```bash
curl https://SEU-ROBO-CONTRATO.easypanel.host/health
```

Simular compra:

```bash
curl -X POST http://robo-contrato:8787/webhook/contrato \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_WEBHOOK_SECRET" \
  -d '{"contratos":[{"tipo_cliente":"empresa","razao_social":"Teste Ltda","cpf_cnpj":"02899404000194","email":"teste@email.com","telefone":"5511999999999","endereco":"Rua A","numero":"1","bairro":"Centro","cidade":"São Paulo","estado":"SP","cep":"01000000","signatario_nome":"João Teste","signatario_cpf":"12345678901","signatario_email":"teste@email.com","signatario_telefone":"5511999999999","quantidade_licencas":"5","valor_mensal":100}]}'
```

(Dentro da rede Docker do EasyPanel; do seu PC use a URL pública.)

## Fluxo automático

```
Cliente paga Stripe → Backend FocoMEI → POST /webhook/contrato → Onety
```

- `quantidade_licencas` e `valor_mensal` vêm da compra real (5/20/50/100).
- Demais campos vêm do cadastro da empresa no FocoMEI.

## Modo manual (opcional)

Localmente, com `config.env`:

```bash
cd services/robo-contrato
pip install -r requirements.txt
python gerar_contrato.py --arquivo entrada/exemplo_contrato.json
python webhook_server.py
```

## Arquivos importantes

| Arquivo | Função |
|---|---|
| `webhook_server.py` | Servidor 24h (Docker/EasyPanel) |
| `gerar_contrato.py` | Lógica de geração no Onety |
| `padrao_lote.py` | Expande JSON mínimo do FocoMEI |
| `entrada/_padrao_focomei.json` | Template FOCO MEI (não apagar) |

Saídas e erros: pasta `saida/` (não versionada).
