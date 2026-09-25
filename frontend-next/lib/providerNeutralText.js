/**
 * Fornecedores internos não fazem parte da linguagem do produto.
 * Mantemos os nomes em código, rotas e logs; apenas o texto mostrado ao usuário é neutro.
 */
const PROVIDER_REPLACEMENTS = [
  [/\bPlugNotas\b/gi, 'emissor fiscal'],
  [/\bTecnoSpeed\b/gi, 'provedor fiscal'],
  [/\bSERPRO\b/gi, 'serviço da Receita Federal'],
  [/\bBrasilAPI\b/gi, 'serviço de consulta cadastral'],
  [/\bSupabase\b/gi, 'serviço de dados'],
  [/\bStripe\b/gi, 'serviço de pagamento'],
  [/\bOnety\b/gi, 'serviço de contratos'],
  [/\bZ-API\b/gi, 'serviço de mensagens'],
  [/\bn8n\b/gi, 'serviço de automação'],
  [/\bOpenClaw\b/gi, 'assistente'],
];

export function neutralizeProviderNames(value) {
  let text = String(value || '');
  for (const [pattern, replacement] of PROVIDER_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}
