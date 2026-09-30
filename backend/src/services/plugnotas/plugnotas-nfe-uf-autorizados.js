/**
 * Grupo de "pessoas autorizadas a acessar o XML" (autXML) da NF-e.
 *
 * O MEI pode informar o CNPJ do contador no cadastro fiscal: ele entra em toda NF-e,
 * em qualquer estado, e o contador passa a conseguir baixar o XML na SEFAZ.
 *
 * Alguns estados exigem esse grupo. Bahia (rejeição 486): "Não informado o Grupo de
 * Autorização para UF que exige a identificação do Escritório de Contabilidade — caso
 * não possua informar o CNPJ da SEFAZ Bahia 13.937.073/0001-56". Sem contador, o
 * sistema usa esse CNPJ padrão.
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

/** CNPJ do contador válido (14 dígitos) ou ''. */
export const normalizeContadorCnpj = (value) => {
  const d = onlyDigits(value);
  return d.length === 14 ? d : '';
};

/**
 * Garante o grupo de autorizados da NF-e.
 * Ordem: autorizado já presente na nota → contador do cadastro → padrão do estado.
 * O CNPJ do destinatário nunca entra (a SEFAZ recusa como redundante).
 * @param {Record<string, unknown>} payload
 * @param {string} emitenteUf
 * @param {{ contadorCnpj?: string|null }} [options]
 * @returns {Record<string, unknown>}
 */
export const applyUfResponsavelAutorizado = (payload, emitenteUf, options = {}) => {
  if (!payload || typeof payload !== 'object') return payload;
  if (readAutorizados(payload).length) return payload;

  const destinatarioDoc = onlyDigits(payload?.destinatario?.cpfCnpj);
  const candidatos = [
    normalizeContadorCnpj(options.contadorCnpj),
    resolveUfAutorizadoXmlPadrao(emitenteUf),
  ].filter((doc) => doc && doc !== destinatarioDoc);
  if (!candidatos.length) return payload;

  return {
    ...payload,
    responsavelAutorizado: [{ cpfCnpj: candidatos[0] }],
  };
};
