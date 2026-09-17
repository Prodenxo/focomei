import { badRequest } from '../utils/errors.js';

/**
 * Subitens da lista nacional que só são aceitos com o grupo de informações da obra.
 * Sem esse grupo o Sistema Nacional NFS-e rejeita a DPS com o erro E0370.
 */
export const NFSE_SUBITENS_QUE_EXIGEM_OBRA = new Set([
  '070201',
  '070202',
  '070401',
  '070501',
  '070502',
  '070601',
  '070602',
  '070701',
  '070801',
  '071701',
  '071901',
  '141403',
  '141404',
]);

/** @param {unknown} codigo */
export const normalizeNfseSubitemKey = (codigo) => (
  String(codigo ?? '').replace(/\D/g, '').slice(0, 6)
);

/** @param {unknown} codigo */
export const nfseServicoExigeObra = (codigo) => (
  NFSE_SUBITENS_QUE_EXIGEM_OBRA.has(normalizeNfseSubitemKey(codigo))
);

/** Formata 070701 como 07.07.01 para exibir ao utilizador. */
export const formatNfseSubitem = (codigo) => {
  const key = normalizeNfseSubitemKey(codigo);
  if (key.length !== 6) return String(codigo ?? '').trim();
  return `${key.slice(0, 2)}.${key.slice(2, 4)}.${key.slice(4, 6)}`;
};

const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '');

const isCompleteCidadePrestacao = (cidade) => {
  if (!cidade || typeof cidade !== 'object') return false;
  const cep = onlyDigits(cidade.cep);
  const codigo = onlyDigits(cidade.codigo || cidade.codigoCidade);
  const estado = String(cidade.estado || cidade.uf || '').trim().toUpperCase();
  return Boolean(
    String(cidade.logradouro || '').trim()
    && String(cidade.numero || '').trim()
    && String(cidade.bairro || '').trim()
    && cep.length === 8
    && codigo.length === 7
    && estado.length === 2
  );
};

/**
 * Monta `cidadePrestacao` (local da obra / prestação) a partir de um endereço PlugNotas.
 * @param {Record<string, unknown>|null|undefined} endereco
 * @returns {Record<string, string>|null}
 */
export const buildCidadePrestacaoFromEndereco = (endereco) => {
  if (!endereco || typeof endereco !== 'object') return null;
  const cidade = {
    codigo: onlyDigits(endereco.codigoCidade || endereco.codigo),
    descricao: String(endereco.descricaoCidade || endereco.descricao || '').trim(),
    logradouro: String(endereco.logradouro || '').trim(),
    numero: String(endereco.numero || '').trim(),
    complemento: String(endereco.complemento || '').trim(),
    bairro: String(endereco.bairro || '').trim(),
    estado: String(endereco.estado || endereco.uf || '').trim().toUpperCase().slice(0, 2),
    cep: onlyDigits(endereco.cep).slice(0, 8),
  };
  if (!isCompleteCidadePrestacao(cidade)) return null;
  if (!cidade.descricao) delete cidade.descricao;
  if (!cidade.complemento) delete cidade.complemento;
  return cidade;
};

const hasObraAddress = (payload) => {
  if (isCompleteCidadePrestacao(payload?.cidadePrestacao)) return true;
  const servicos = Array.isArray(payload?.servico) ? payload.servico : [];
  return servicos.some((servico) => (
    isCompleteCidadePrestacao(servico?.obra?.endereco)
    || isCompleteCidadePrestacao(servico?.obra)
  ));
};

/**
 * Para códigos de obra, preenche o local da obra com o endereço do cliente
 * quando o utilizador não informou outro endereço.
 * @param {Record<string, unknown>} payload
 * @returns {Record<string, unknown>}
 */
export const applyNfseObraFromTomadorEndereco = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  const servicos = Array.isArray(payload.servico) ? payload.servico : [];
  if (!servicos.some((servico) => nfseServicoExigeObra(servico?.codigo))) {
    return payload;
  }

  const enderecoFonte = payload.obra?.endereco
    || servicos.find((servico) => servico?.obra?.endereco)?.obra?.endereco
    || payload.tomador?.endereco;
  const cidade = isCompleteCidadePrestacao(payload.cidadePrestacao)
    ? payload.cidadePrestacao
    : buildCidadePrestacaoFromEndereco(enderecoFonte);

  const next = { ...payload };
  if (cidade && !isCompleteCidadePrestacao(payload.cidadePrestacao)) {
    next.cidadePrestacao = cidade;
  }

  next.servico = servicos.map((servico) => {
    if (!nfseServicoExigeObra(servico?.codigo)) return servico;
    const obra = servico?.obra && typeof servico.obra === 'object' ? { ...servico.obra } : {};
    if (!isCompleteCidadePrestacao(obra.endereco) && enderecoFonte) {
      obra.endereco = { ...enderecoFonte };
    }
    return { ...servico, obra };
  });
  return next;
};

/**
 * Barra a emissão se o código exige obra e ainda não há endereço do local.
 * @throws {import('../utils/errors.js').HttpError} 400
 */
export const assertNfseServicoObraSuportado = (payload) => {
  const servicos = Array.isArray(payload?.servico) ? payload.servico : [];
  servicos.forEach((servico) => {
    if (!nfseServicoExigeObra(servico?.codigo)) return;
    if (hasObraAddress(payload)) return;
    const subitem = formatNfseSubitem(servico?.codigo);
    throw badRequest(
      `O código de serviço ${subitem} exige o endereço da obra. `
      + 'Informe o endereço completo do cliente (usamos o mesmo da obra) '
      + 'ou o endereço onde o serviço foi feito.',
      {
        code: 'NFSE_SERVICO_EXIGE_OBRA',
        codigo: subitem,
        botHint:
          'Peça o endereço da obra. Se for o mesmo do cliente, confirme e reenvie o preview/emissão.',
      },
    );
  });
};
