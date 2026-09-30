/**
 * Alguns estados só autorizam a NF-e se a nota trouxer o grupo de "pessoas
 * autorizadas a acessar o XML" (autXML) com o CNPJ do escritório de contabilidade.
 * Quem não tem contador informa o CNPJ da própria SEFAZ do estado.
 *
 * Bahia (rejeição 486): "Não informado o Grupo de Autorização para UF que exige a
 * identificação do Escritório de Contabilidade — caso não possua informar o CNPJ da
 * SEFAZ Bahia 13.937.073/0001-56".
 *
 * No JSON do emissor o grupo se chama `responsavelAutorizado: [{ cpfCnpj }]`.
 */
export const UF_AUTORIZADO_XML_PADRAO = Object.freeze({
  BA: '13937073000156',
});

const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '');

const normalizeUf = (value) => String(value || '').trim().toUpperCase().slice(0, 2);

const readAutorizados = (payload) => {
  const raw = payload?.responsavelAutorizado;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => onlyDigits(item?.cpfCnpj ?? item?.cnpj ?? item?.cpf))
    .filter((doc) => doc.length === 11 || doc.length === 14);
};

/**
 * CNPJ padrão de autorizado que o estado do emitente exige, ou '' quando não exige.
 * @param {string} emitenteUf
 */
export const resolveUfAutorizadoXmlPadrao = (emitenteUf) => (
  UF_AUTORIZADO_XML_PADRAO[normalizeUf(emitenteUf)] || ''
);

/**
 * Garante o grupo de autorizados quando o estado do emitente exige.
 * Não mexe se a nota já traz algum autorizado (ex.: contador do cliente).
 * @param {Record<string, unknown>} payload
 * @param {string} emitenteUf
 * @returns {Record<string, unknown>}
 */
export const applyUfResponsavelAutorizado = (payload, emitenteUf) => {
  if (!payload || typeof payload !== 'object') return payload;
  const padrao = resolveUfAutorizadoXmlPadrao(emitenteUf);
  if (!padrao) return payload;
  if (readAutorizados(payload).length) return payload;

  const destinatarioDoc = onlyDigits(payload?.destinatario?.cpfCnpj);
  if (destinatarioDoc && destinatarioDoc === padrao) return payload;

  return {
    ...payload,
    responsavelAutorizado: [{ cpfCnpj: padrao }],
  };
};
