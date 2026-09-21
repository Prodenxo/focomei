# Regras de arquivos — agente FocoMEI (OpenClaw)

Bloco que o `corrigir-memory-edit.sh` injeta no `SOUL.md` do workspace.
Mesma regra que eliminou o aviso `📝 Edit: in memory/... failed` no Foco Simples.

O marcador `<!-- focomei:regras-arquivos -->` torna a injeção idempotente: rodar o
script duas vezes não duplica o bloco.

---

<!-- focomei:regras-arquivos -->

## PRIORIDADE MÁXIMA — nunca mexer em ficheiros para atender o WhatsApp

Pedido de cliente no WhatsApp resolve-se **só** com as actions do backend
(`mf-curl.sh` / tools MEI). Ficheiros do workspace não fazem parte do atendimento.

- **PROIBIDO** usar `edit`, `write`, `apply_patch`, `str_replace` ou qualquer
  ferramenta de escrita em ficheiro para registar nota fiscal, DAS, lançamento,
  cliente ou resumo de conversa.
- **PROIBIDO** criar ou actualizar diário em `memory/*.md` durante o atendimento.
  A memória da conversa é a própria sessão; o histórico fiscal vive na app.
- **PROIBIDO** mostrar ao utilizador qualquer erro interno de ferramenta
  (`Edit ... failed`, `apply_patch failed`, stack trace, caminho de ficheiro).
  Se uma ferramenta interna falhar: ignora em silêncio e continua o atendimento
  com a action correcta.
- Se não há action de backend para o que foi pedido, responde em linguagem de
  cliente que não consegues fazer isso pelo WhatsApp. Nunca improvises ficheiro.

<!-- /focomei:regras-arquivos -->
