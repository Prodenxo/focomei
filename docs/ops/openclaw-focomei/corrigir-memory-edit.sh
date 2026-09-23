#!/bin/sh
# FocoMEI — elimina o aviso "📝 Edit: in memory/....md failed" que vaza no WhatsApp.
#
# Onde rodar: EasyPanel → serviço do OpenClaw do FocoMEI → Console (serviço Running).
# Uso:  sh corrigir-memory-edit.sh          (diagnostica e corrige)
#       DRY_RUN=1 sh corrigir-memory-edit.sh (só diagnostica)
#
# O que faz:
#   1. diagnostica workspace, pasta memory/, escrita, disco e persistência do volume;
#   2. cria memory/ (a falha mais comum é a pasta sumir a cada deploy);
#   3. injeta no SOUL.md a regra que proíbe ferramentas de arquivo e proíbe
#      mostrar erro interno ao cliente (idempotente, com backup);
#   4. mostra as chaves de tools/notificações do openclaw.json para conferência.
set -e

WS="${OPENCLAW_WORKSPACE:-/home/node/.openclaw/workspace}"
CFG="${OPENCLAW_CONFIG:-/home/node/.openclaw/openclaw.json}"
SOUL="$WS/SOUL.md"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "== 1. diagnóstico =="
echo "workspace: $WS"
[ -d "$WS" ] || { echo "ERRO: workspace não existe. Confira OPENCLAW_WORKSPACE."; exit 1; }

if [ -d "$WS/memory" ]; then
  echo "memory/: existe ($(ls -1 "$WS/memory" 2>/dev/null | wc -l) arquivos)"
  ls -1t "$WS/memory" 2>/dev/null | head -5 | sed 's/^/  - /'
else
  echo "memory/: AUSENTE  <-- causa provável do Edit failed"
fi

if touch "$WS/.write-test" 2>/dev/null; then
  echo "escrita no workspace: ok"
  rm -f "$WS/.write-test"
else
  echo "escrita no workspace: FALHOU  <-- volume somente leitura ou permissão errada"
fi

echo "disco:"
df -h "$WS" 2>/dev/null | tail -1 | sed 's/^/  /'

echo "persistência do volume:"
if grep -q " $(dirname "$WS") \| $WS " /proc/mounts 2>/dev/null; then
  grep " $(dirname "$WS") \| $WS " /proc/mounts | sed 's/^/  /'
else
  echo "  NENHUM mount dedicado  <-- workspace vive no filesystem do container"
  echo "  (a cada deploy o conteúdo some; monte um volume em /home/node/.openclaw)"
fi

echo
echo "== 2. config do agente =="
if [ -f "$CFG" ]; then
  node -e '
const fs = require("fs");
const cfg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const show = (label, value) => console.log("  " + label + ": " + (value === undefined ? "(não definido)" : JSON.stringify(value)));
show("tools.allow", cfg.tools && cfg.tools.allow);
show("tools.deny", cfg.tools && cfg.tools.deny);
show("agents.defaults", cfg.agents && cfg.agents.defaults);
show("channels.whatsapp", cfg.channels && cfg.channels.whatsapp);
' "$CFG"
  echo "  (se tools.allow estiver vazio, o agente tem TODAS as ferramentas de arquivo liberadas)"
else
  echo "  $CFG não encontrado"
fi

if [ -n "$DRY_RUN" ]; then
  echo
  echo "DRY_RUN ativo: nada foi alterado."
  exit 0
fi

echo
echo "== 3. corrigindo =="
mkdir -p "$WS/memory"
echo "memory/ garantida em $WS/memory"

[ -f "$SOUL" ] || { echo "ERRO: $SOUL não encontrado. Rode o install do workspace antes."; exit 1; }
cp "$SOUL" "$SOUL.bak-$STAMP"
echo "backup do SOUL: $SOUL.bak-$STAMP"

node -e '
const fs = require("fs");
const soulPath = process.argv[1];
const soul = fs.readFileSync(soulPath, "utf8");
if (soul.includes("<!-- focomei:regras-arquivos -->")) {
  console.log("regras já presentes no SOUL, nada a fazer");
  process.exit(0);
}
const bloco = [
  "",
  "<!-- focomei:regras-arquivos -->",
  "",
  "## PRIORIDADE MÁXIMA — nunca mexer em ficheiros para atender o WhatsApp",
  "",
  "Pedido de cliente no WhatsApp resolve-se **só** com as actions do backend",
  "(`mf-curl.sh` / tools MEI). Ficheiros do workspace não fazem parte do atendimento.",
  "",
  "- **PROIBIDO** usar `edit`, `write`, `apply_patch`, `str_replace` ou qualquer",
  "  ferramenta de escrita em ficheiro para registar nota fiscal, DAS, lançamento,",
  "  cliente ou resumo de conversa.",
  "- **PROIBIDO** criar ou actualizar diário em `memory/*.md` durante o atendimento.",
  "  A memória da conversa é a própria sessão; o histórico fiscal vive na app.",
  "- **PROIBIDO** mostrar ao utilizador qualquer erro interno de ferramenta",
  "  (`Edit ... failed`, `apply_patch failed`, stack trace, caminho de ficheiro).",
  "  Se uma ferramenta interna falhar: ignora em silêncio e continua o atendimento",
  "  com a action correcta.",
  "- Se não há action de backend para o que foi pedido, responde em linguagem de",
  "  cliente que não consegues fazer isso pelo WhatsApp. Nunca improvises ficheiro.",
  "",
  "<!-- /focomei:regras-arquivos -->",
  "",
].join("\n");

/* Entra logo após o título, para ficar entre as regras de prioridade máxima. */
const linhas = soul.split("\n");
const corte = linhas.findIndex((linha, i) => i > 0 && linha.startsWith("## "));
const posicao = corte > 0 ? corte : 1;
linhas.splice(posicao, 0, bloco);
fs.writeFileSync(soulPath, linhas.join("\n"));
console.log("regras injetadas no SOUL (linha " + posicao + ")");
' "$SOUL"

echo "SOUL agora com $(wc -c < "$SOUL") bytes"

echo
echo "== 4. próximos passos manuais =="
echo "1) EasyPanel → serviço OpenClaw → Mounts: garanta um volume em /home/node/.openclaw"
echo "   (sem isso o workspace e a memory/ somem a cada deploy e o erro volta)"
echo "2) Restart do serviço OpenClaw"
echo "3) No WhatsApp, envie /new para limpar a sessão que carrega o SOUL antigo"
echo "4) Teste: peça uma emissão de nota e confirme que nenhum aviso de ferramenta aparece"
