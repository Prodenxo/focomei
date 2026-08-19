# Onety CRM + Contrato — integração FocoMEI

Documentação operacional da API Onety usada pelo fluxo **funil → lead → Proposta → contrato**.

## Visão geral

```
[FocoMEI admin]
  1. Seleciona funil comercial
  2. Clica "Gerar contrato"
  3. Backend → robô CRM (criar lead + mover Proposta)
  4. Backend → robô contrato (geração Autentique existente)

[Onety — automático]
  ~3s após Proposta → abre tela de geração de contrato
  Após assinatura → fase Ganhou (Onety)
```

O FocoMEI **não** duplica a tela de contrato do Onety; prepara o card no CRM antes da geração já existente via `robo-contrato`.

## Base e autenticação

| Item | Valor |
|------|--------|
| Base API | `https://back.cfonety.com.br` |
| Auth | `Authorization: Bearer <JWT>` |
| Header empresa | `x-empresa-id: 785` |
| `empresa_id` (payload) | `785` |

Credenciais: mesmo `config.env` do serviço `services/robo-contrato/` (`EMAIL`, `SENHA`, `EMPRESA_ID`).

## Mapa de funis (`funil_id`)

| Funil | ID | Fase Lead | Fase Proposta |
|-------|-----|-----------|---------------|
| Tráfego Pago | 598 | _pendente_ | _pendente_ |
| Franqueado Cf | 583 | _pendente_ | _pendente_ |
| **BNI** | **597** | **2874** | **2871** |
| Workshop - Método Mei Lucrativo | 716 | _pendente_ | _pendente_ |
| Funil De Aquisição Whatsapp | 794 | _pendente_ | _pendente_ |
| Funil De Captação - Evento Dna Contábil | 807 | _pendente_ | _pendente_ |
| Contrio Mangaratiba | 682 | _pendente_ | _pendente_ |

Fases Lead/Proposta variam por funil. Configurar em `backend/src/config/onety-crm-funis.js` após capturar no DevTools (arrastar card Lead → Proposta).

## Endpoints CRM

### Criar lead

```http
POST /comercial/leads
Content-Type: application/json
Authorization: Bearer <token>
x-empresa-id: 785
```

**Payload (exemplo BNI):**

```json
{
  "nome": "Leo teste",
  "telefone": "2111111111",
  "email": "cliente@exemplo.com",
  "data_prevista": null,
  "funil_id": 597,
  "funil_fase_id": 2874,
  "usuario_id": 1083,
  "pre_venda_id": null,
  "empresa_id": 785,
  "valor": 100,
  "status": "aberto"
}
```

**Response `201`:**

```json
{
  "message": "Lead criado com sucesso.",
  "leadId": 74598
}
```

### Mover para Proposta

```http
PUT /comercial/leads/{leadId}/mover-fase
```

**Payload:**

```json
{
  "funil_fase_id": 2871
}
```

**Response:** `200 OK`

Após o `mover-fase`, o Onety abre a tela de contrato (~3s). A geração Autentique continua sendo feita pelo webhook `/webhook/contrato` existente.

### Endpoints auxiliares (UI Onety — robô não precisa)

- `GET /comercial/leads/{leadId}` — refresh do card
- `GET /comercial/funil-fases/{funil_id}/metas` — KPIs do funil

## Webhooks do robô (`services/robo-contrato`)

| Rota | Uso |
|------|-----|
| `POST /webhook/contrato` | Gera contrato Autentique (fluxo existente) |
| `POST /webhook/crm/preparar-proposta` | Cria lead + move para Proposta |

Auth: `Authorization: Bearer <WEBHOOK_SECRET>` (mesmo segredo do contrato).

**Payload CRM:**

```json
{
  "nome": "Razão Social Ltda",
  "telefone": "21999998888",
  "email": "admin@empresa.com",
  "funil_id": 597,
  "funil_fase_id_lead": 2874,
  "funil_fase_id_proposta": 2871,
  "usuario_id": 1083,
  "empresa_id": 785,
  "valor": 149.9
}
```

**Response:**

```json
{
  "ok": true,
  "leadId": 74598,
  "fase_proposta_id": 2871
}
```

## Variáveis de ambiente (backend FocoMEI)

```env
# Contrato (existente)
ONETY_CONTRATO_WEBHOOK_URL=http://robo-contrato:8787/webhook/contrato
ONETY_CONTRATO_WEBHOOK_SECRET=mesmo_WEBHOOK_SECRET_do_robo

# CRM (opcional — se vazio, deriva de ONETY_CONTRATO_WEBHOOK_URL)
# ONETY_CRM_WEBHOOK_URL=http://robo-contrato:8787/webhook/crm/preparar-proposta

# Vendedor padrão ao criar lead (usuario_id Onety)
ONETY_CRM_DEFAULT_VENDEDOR_ID=1083
```

## Fluxo admin FocoMEI

1. `GET /api/admin/billing/onety-crm/funis` — lista funis disponíveis (`ready: true` quando fases configuradas)
2. `POST /api/admin/billing/stripe/emit-contrato` com `{ empresaId, funilId?, vendedorId?, valor? }`
3. Se `funilId` informado: CRM primeiro, depois contrato
4. Se `funilId` omitido: só contrato (comportamento anterior)

## Descobrir fases de um funil novo

1. Abrir funil no Onety (`?funil=<id>`)
2. DevTools → Network → filtro `comercial`
3. Criar lead manual → anotar `funil_fase_id` da coluna Lead
4. Arrastar para Proposta → anotar `funil_fase_id` do `mover-fase`
5. Atualizar `backend/src/config/onety-crm-funis.js`

## Segurança

- Não commitar JWT, senha ou `WEBHOOK_SECRET` em repositório
- Renovar sessão Onety se token vazar
- Webhook só em rede interna ou com Bearer obrigatório
