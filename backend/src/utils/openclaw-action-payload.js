/**
 * OpenClaw LLMs often put fields at the top level of the action body
 * instead of nesting under `payload`. Merge both shapes.
 */

const RESERVED_TOP_LEVEL_KEYS = new Set([
  'action',
  'phone',
  'payload',
  'senderPhone',
  'sender_phone',
]);

/**
 * @param {Record<string, unknown>|null|undefined} body
 * @returns {Record<string, unknown>}
 */
export const mergeOpenclawActionPayload = (body = {}) => {
  const nested =
    body?.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
      ? { ...body.payload }
      : {};

  const flat = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (RESERVED_TOP_LEVEL_KEYS.has(key)) continue;
    if (value === undefined) continue;
    flat[key] = value;
  }

  // Nested payload wins over flat duplicates (explicit contract).
  return { ...flat, ...nested };
};

/**
 * Aliases comuns que o modelo inventa (snake_case / ids).
 * @param {Record<string, unknown>} payload
 * @returns {Record<string, unknown>}
 */
export const normalizeOpenclawNfsePayloadAliases = (payload = {}) => {
  const out = { ...payload };

  const clienteId = firstString(
    out.catalogoClienteId,
    out.clienteId,
    out.cliente_id,
    out.tomadorId,
    out.tomador_id,
  );
  if (clienteId && !out.catalogoClienteId) {
    out.catalogoClienteId = clienteId;
  }

  const codigo = firstString(
    out.codigoServico,
    out.servico_codigo,
    out.codigo_servico,
    out.codigo,
  );
  if (codigo && !out.codigoServico) {
    out.codigoServico = codigo;
  }

  const valor = out.valorServico ?? out.valor ?? out.valorReais ?? out.valor_servico;
  if (valor !== undefined && out.valor === undefined) {
    out.valor = valor;
  }

  const tomadorNome = firstString(
    out.tomadorNome,
    out.tomador_nome,
    out.clienteNome,
    out.cliente_nome,
    out.nomeCliente,
    out.cliente,
  );
  if (tomadorNome && !out.tomadorNome) {
    out.tomadorNome = tomadorNome;
  }

  const servicoIndice = out.servicoIndice ?? out.servico_indice ?? out.servicoNumero ?? out.indice;
  if (servicoIndice !== undefined && out.servicoIndice === undefined) {
    out.servicoIndice = servicoIndice;
  }

  if (out.confirm === undefined && (out.confirma !== undefined || out.confirmed !== undefined)) {
    out.confirm = out.confirma ?? out.confirmed;
  }

  return out;
};

const firstString = (...values) => {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
};
