#!/bin/sh
# DeepSeek no OpenClaw 2026.4.x (sem plugin @openclaw/deepseek-provider — exige API >= 2026.8.1)
#
# Onde correr: Console do serviço OpenClaw no Easypanel (MeiInfinito Midas ou FocoMEI).
# Pré-requisito: DEEPSEEK_API_KEY no Environment do serviço + Restart do container.
#
# Depois: Restart Easypanel → WhatsApp /new

set -e

CFG="${OPENCLAW_STATE_DIR:-/home/node/.openclaw}/openclaw.json"
MODEL="${OPENCLAW_DEEPSEEK_MODEL:-deepseek-chat}"

node << NODE
const fs = require('fs');
const p = process.env.CFG || '/home/node/.openclaw/openclaw.json';
const key = String(process.env.DEEPSEEK_API_KEY || '').trim();
const modelId = String(process.env.OPENCLAW_DEEPSEEK_MODEL || 'deepseek-chat').trim();

if (!key) {
  console.error('ERRO: DEEPSEEK_API_KEY ausente no Environment. Adiciona no Easypanel e reinicia o container.');
  process.exit(1);
}

let c = {};
try {
  c = JSON.parse(fs.readFileSync(p, 'utf8'));
} catch (e) {
  console.error('ERRO: openclaw.json invalido:', e.message);
  process.exit(1);
}

c.models = c.models || {};
c.models.providers = c.models.providers || {};
c.models.providers.deepseek = {
  baseUrl: 'https://api.deepseek.com',
  api: 'openai-completions',
  apiKey: key,
  models: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', contextWindow: 64000 },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', contextWindow: 64000 },
  ],
};

c.agents = c.agents || {};
c.agents.defaults = c.agents.defaults || {};
c.agents.defaults.model = { primary: \`deepseek/\${modelId}\` };

fs.writeFileSync(p, JSON.stringify(c, null, 2));
console.log('[ok] model:', c.agents.defaults.model.primary);
console.log('[ok] config:', p);
NODE

echo ""
echo "Confere:"
openclaw models list --provider deepseek || true
echo ""
echo "Proximo: Restart do servico no Easypanel (nao openclaw gateway restart) e /new no WhatsApp."
