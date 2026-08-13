#!/bin/sh
# Repara mf-curl.sh no Console EasyPanel (openclawfocomei) quando há loop:
#   /bin/bash: warning: shell level (1000) too high
# Causa típica: `curl` no PATH aponta para mf-curl.sh ou wrapper quebrado.
#
# Uso (Console do openclawfocomei, com MF_API_URL e OPENCLAW_WEBHOOK_SECRET no env):
#   sh /home/node/.openclaw/workspace/repair-mf-curl-console.sh
# ou colar este ficheiro inteiro no Console após copiar para o workspace.

set -e
WS="${OPENCLAW_WORKSPACE:-/home/node/.openclaw/workspace}"
MF_URL="${MF_API_URL:?Defina MF_API_URL no EasyPanel}"
MF_SEC="${OPENCLAW_WEBHOOK_SECRET:?Defina OPENCLAW_WEBHOOK_SECRET no EasyPanel}"

MF_URL_ESC=$(printf "%s" "$MF_URL" | sed "s/'/'\\\\''/g")
MF_SEC_ESC=$(printf "%s" "$MF_SEC" | sed "s/'/'\\\\''/g")

mkdir -p "$WS"

cat > "$WS/mf-curl-resolve-sender.cjs" << 'EOF'
const fs = require('fs');
const path = require('path');
const digits = (v) => String(v ?? '').replace(/\D/g, '');
const valid = (v) => digits(v).length >= 10;
const workspaceDir = process.argv[2] || '/home/node/.openclaw/workspace';
const agentArg = process.argv[3] || '';
const pinPath = path.join(workspaceDir, '.mf-inbound-sender');
let pin = '';
try { if (fs.existsSync(pinPath)) pin = digits(fs.readFileSync(pinPath, 'utf8')); } catch (_) {}
const agent = digits(agentArg);
let sender = '';
if (valid(agent)) {
  sender = agent;
  try { fs.writeFileSync(pinPath, sender); } catch (_) {}
} else if (valid(pin)) {
  sender = pin;
} else {
  console.error('mf-curl: telefone remetente inválido (use DDI 55, >=10 dígitos)');
  process.exit(1);
}
process.stdout.write(sender);
EOF

cat > "$WS/mf-curl.sh" << CURL_EOF
#!/bin/sh
set -e
WS_DIR="\$(cd "\$(dirname "\$0")" && pwd)"
AGENT_ARG="\${1:?mf-curl.sh: falta TELEFONE_REMETENTE (1º arg)}"
shift
JSON="\${1:?mf-curl.sh: falta JSON (2º arg)}"
MF_URL='$MF_URL_ESC'
MF_SEC='$MF_SEC_ESC'
SENDER="\$(node "\$WS_DIR/mf-curl-resolve-sender.cjs" "\$WS_DIR" "\$AGENT_ARG")" || exit 1
BODY="\$(node -e "
const sender=process.argv[1];
const raw=process.argv[2];
let j=JSON.parse(raw);
j.phone=String(sender).replace(/\\\\D/g,'');
console.log(JSON.stringify(j));
" "\$SENDER" "\$JSON")"
CURL_BIN="/usr/bin/curl"
if [ ! -x "\$CURL_BIN" ]; then
  CURL_BIN="\$(command -v curl 2>/dev/null || true)"
fi
if [ -z "\$CURL_BIN" ] || [ "\$CURL_BIN" = "\$0" ] || [ "\$CURL_BIN" = "\$WS_DIR/mf-curl.sh" ]; then
  echo "mf-curl: curl do sistema inválido ou loop (curl -> mf-curl.sh)" >&2
  exit 1
fi
exec "\$CURL_BIN" -sS --max-time 120 -X POST "\$MF_URL" \\
  -H 'Content-Type: application/json; charset=utf-8' \\
  -H "Authorization: Bearer \$MF_SEC" \\
  -H "X-WhatsApp-Sender: \$SENDER" \\
  -d "\$BODY"
CURL_EOF

chmod +x "$WS/mf-curl.sh"

echo "=== Diagnóstico ==="
echo -n "which curl: "; command -v curl || echo "(não encontrado)"
echo -n "/usr/bin/curl: "; ls -la /usr/bin/curl 2>/dev/null || echo "(ausente)"
head -n 3 "$WS/mf-curl.sh"

echo ""
echo "=== Teste ping ==="
"$WS/mf-curl.sh" 5521983992146 '{"action":"ping"}' | head -c 400
echo ""
echo "[ok] mf-curl.sh reparado em $WS/mf-curl.sh"
