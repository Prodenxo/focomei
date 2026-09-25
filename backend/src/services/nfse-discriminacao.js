/**
 * Discriminação do serviço na NFS-e: o emissor (PlugNotas) recusa o JSON quando o texto
 * traz quebra de linha — o separador aceito é o "|" (pipe).
 * @see https://docs.plugnotas.com.br — "Para quebra de linha, utilize o | (Pipe)"
 */

const LINE_BREAK_WITH_SPACES = /\s*[\r\n]+\s*/g;

/**
 * Converte quebras de linha digitadas pelo utilizador no separador aceito pelo emissor.
 * @param {unknown} value
 * @returns {string|null} texto normalizado, ou `null` quando fica vazio
 */
export const sanitizeNfseDiscriminacao = (value) => {
  if (value === undefined || value === null) return null;

  const text = String(value)
    .replace(LINE_BREAK_WITH_SPACES, '|')
    // Linha em branco ou pipe já digitado antes do Enter viram um único separador.
    .replace(/\|{2,}/g, '|')
    .replace(/^\|+/, '')
    .replace(/\|+$/, '')
    .trim();

  return text || null;
};

/**
 * Normaliza `servico[].discriminacao` do payload NFS-e antes do envio ao emissor.
 * @template {{ servico?: unknown }} T
 * @param {T} payload
 * @returns {T} o mesmo payload, com as discriminações normalizadas
 */
export const applyNfseDiscriminacaoLineBreaks = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  if (!Array.isArray(payload.servico)) return payload;

  payload.servico.forEach((servico) => {
    if (!servico || typeof servico !== 'object') return;
    const sanitized = sanitizeNfseDiscriminacao(servico.discriminacao);
    // Discriminação ausente/vazia continua a cargo da validação do payload.
    if (sanitized !== null) servico.discriminacao = sanitized;
  });

  return payload;
};
