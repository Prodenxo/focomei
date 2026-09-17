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

const hasObraInfo = (servico, payload) => Boolean(
  servico?.obra
  || servico?.construcaoCivil
  || payload?.obra
  || payload?.construcaoCivil,
);

/**
 * Barra a emissão antes de enviar: a nota seria rejeitada e o número da DPS seria perdido.
 * @throws {import('../utils/errors.js').HttpError} 400
 */
export const assertNfseServicoObraSuportado = (payload) => {
  const servicos = Array.isArray(payload?.servico) ? payload.servico : [];
  servicos.forEach((servico) => {
    if (!nfseServicoExigeObra(servico?.codigo)) return;
    if (hasObraInfo(servico, payload)) return;
    const subitem = formatNfseSubitem(servico?.codigo);
    throw badRequest(
      `O código de serviço ${subitem} é de obra e a nota nacional exige os dados da obra, `
      + 'que o Foco MEI ainda não envia. Se o seu serviço não é de obra, troque o código '
      + 'do serviço em MEI → Notas (por exemplo, limpeza e conservação de imóveis é 07.10.02).',
      {
        code: 'NFSE_SERVICO_EXIGE_OBRA',
        codigo: subitem,
        botHint:
          'Não tente emitir de novo com o mesmo código. Explique que o código cadastrado é de obra '
          + 'e peça para o utilizador corrigir o código do serviço na app.',
      },
    );
  });
};
