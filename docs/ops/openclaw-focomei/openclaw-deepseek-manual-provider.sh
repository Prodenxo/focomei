#!/bin/sh
# DeepSeek no OpenClaw 2026.4.x — FocoMEI (copia de meiinfinito/docs/ops/openclaw-deepseek-manual-provider.sh)
# Ver apps/meiinfinito/docs/ops/openclaw-deepseek-manual-provider.sh

set -e
CFG="${OPENCLAW_STATE_DIR:-/home/node/.openclaw}/openclaw.json"
MODEL="${OPENCLAW_DEEPSEEK_MODEL:-deepseek-chat}"

node << NODE
const fs = require('fs');
const p = process.env.CFG || '/home/node/.openclaw/openclaw.json';
const key = String(process.env.DEEPSEEK_API_KEY || '').trim();
const modelId = String(process.env.OPENCLAW_DEEPSEEK_MODEL || 'deepseek-chat').trim();
if (!key) { console.error('ERRO: DEEPSEEK_API_KEY ausente no Easypanel'); process.exit(1); }
let c = JSON.parse(fs.readFileSync(p, 'utf8'));
c.models = c.models || {}; c.models.providers = c.models.providers || {};
c.models.providers.deepseek = {
  baseUrl: 'https://api.deepseek.com', api: 'openai-completions', apiKey: key,
  models: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', contextWindow: 64000 },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', contextWindow: 64000 },
  ],
};
c.agents = c.agents || {}; c.agents.defaults = c.agents.defaults || {};
c.agents.defaults.model = { primary: \`deepseek/\${modelId}\` };
fs.writeFileSync(p, JSON.stringify(c, null, 2));
console.log('[ok]', c.agents.defaults.model.primary);
NODE
openclaw models list --provider deepseek || true
echo "Restart Easypanel + /new WhatsApp"
