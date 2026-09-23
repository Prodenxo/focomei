# OpenClaw FocoMEI — correção do "Edit: in memory/... failed"

## O problema

O cliente recebe no WhatsApp avisos como:

```
⚠️ 📝 Edit: in memory/2026-08-13-nota-fiscal-servico.md failed
```

Isso é o agente OpenClaw tentando escrever num diário de memória em markdown e
falhando. O aviso é de ferramenta interna e não deveria sair no chat.

## Por que não dá para filtrar no backend FocoMEI

O FocoMEI roda em **modo dual QR**: o OpenClaw tem o WhatsApp conectado no próprio
número e responde direto. O backend só recebe a mensagem de entrada
(`/api/webhooks/zapi/inbound`) e repassa (`OPENCLAW_ZAPI_RELAY_URL`); o texto de
saída nunca passa por nós. Não há ponto de interceptação do lado da aplicação.

Confirmação no código: `backend/src/services/zapi-inbound.service.js` (`relayZapiInbound`
só faz POST e descarta a resposta) e `docs/ops` do Foco Simples, seção "Modo dual QR".

## Causas, em ordem de probabilidade

1. **Workspace sem volume persistente.** A cada deploy o container é recriado, a
   pasta `memory/` some, mas o agente continua com o caminho antigo no contexto.
   O arquivo citado é de 13/08 — semanas antes da conversa, o que combina com isso.
2. **Concorrência.** Várias conversas editando o mesmo arquivo fazem o trecho
   esperado mudar entre a leitura e a escrita, e a substituição exata falha.
3. **Disco cheio ou permissão de escrita** no volume do container.

## Correção

No EasyPanel, serviço do OpenClaw do FocoMEI, aba Console (serviço Running):

```sh
DRY_RUN=1 sh corrigir-memory-edit.sh   # só diagnostica
sh corrigir-memory-edit.sh             # diagnostica e corrige
```

Se o arquivo não estiver no container, cole o conteúdo do script direto no Console.

O script cria a pasta `memory/`, faz backup do `SOUL.md` e injeta a regra que
proíbe o agente de usar ferramentas de arquivo e de mostrar erro interno ao
cliente — a mesma que resolveu o caso no Foco Simples (`SOUL.md` de 17/09).

Depois: montar volume em `/home/node/.openclaw`, reiniciar o serviço e enviar
`/new` no WhatsApp para descartar a sessão com o SOUL antigo.

## Verificação

Peça uma emissão de nota pelo WhatsApp. O esperado é receber só a mensagem de
negócio (confirmação ou motivo da recusa), sem nenhuma linha de ferramenta.
