/**
 * Funis comerciais Onety (empresa 785) habilitados para gerar contrato via FocoMEI.
 * faseLeadId: POST /comercial/leads (fase inicial do kanban)
 * fasePropostaId: PUT .../mover-fase (coluna Proposta)
 *
 * Funis sem fases CRM (não liberados para contrato):
 * - 794 Funil De Aquisição Whatsapp
 * - 682 Contrio Mangaratiba
 */
export const ONETY_EMPRESA_ID = 785

/** Funil fixo do cadastro self-serve (todos os leads caem em Tráfego Pago). */
export const ONETY_CRM_SELF_SERVE_FUNIL_ID = 598

/** @type {Array<{ id: number, name: string, selfServeLabel: string, faseLeadId: number, fasePropostaId: number }>} */
export const ONETY_CRM_FUNIS = [
  {
    id: 598,
    name: 'Tráfego Pago',
    selfServeLabel: 'Anúncio na internet / redes sociais',
    faseLeadId: 2880,
    fasePropostaId: 2877,
  },
  {
    id: 583,
    name: 'Franqueado Cf',
    selfServeLabel: 'Indicação de franqueado / parceiro',
    faseLeadId: 2827,
    fasePropostaId: 2798,
  },
  {
    id: 597,
    name: 'BNI',
    selfServeLabel: 'Indicação BNI',
    faseLeadId: 2874,
    fasePropostaId: 2871,
  },
  {
    id: 716,
    name: 'Workshop - Método Mei Lucrativo',
    selfServeLabel: 'Workshop Mei Lucrativo',
    faseLeadId: 3482,
    fasePropostaId: 3479,
  },
  {
    id: 807,
    name: 'Funil De Captação - Evento Dna Contábil',
    selfServeLabel: 'Evento DNA Contábil',
    faseLeadId: 3951,
    fasePropostaId: 3948,
  },
]

export const getFunilById = (funilId) => {
  const id = Number(funilId)
  if (!Number.isFinite(id)) return null
  return ONETY_CRM_FUNIS.find((f) => f.id === id) || null
}

const hasCrmFases = (funil) => Boolean(funil.faseLeadId && funil.fasePropostaId)

export const listFunisDisponiveis = () =>
  ONETY_CRM_FUNIS.map((f) => ({
    id: f.id,
    name: f.name,
    selfServeLabel: f.selfServeLabel || f.name,
    ready: hasCrmFases(f),
    crmEnabled: hasCrmFases(f),
    faseLeadId: f.faseLeadId,
    fasePropostaId: f.fasePropostaId,
  })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

/** Funil usado no cadastro self-serve (override via ONETY_CRM_SELF_SERVE_FUNIL_ID). */
export const getSelfServeFunil = (overrideId) => {
  const raw = overrideId ?? ONETY_CRM_SELF_SERVE_FUNIL_ID
  const id = Number(raw)
  if (!Number.isFinite(id) || id <= 0) return null
  return getFunilById(id)
}

/** @deprecated Self-serve usa funil fixo — mantido p/ admin. */
export const listFunisSelfServe = () => listFunisDisponiveis().filter((f) => f.ready)

export const funilRequiresCrmPrep = (funilId) => {
  const funil = getFunilById(funilId)
  if (!funil) return false
  return hasCrmFases(funil)
}
