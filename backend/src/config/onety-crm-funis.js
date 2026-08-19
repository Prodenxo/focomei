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

/** @type {Array<{ id: number, name: string, faseLeadId: number, fasePropostaId: number }>} */
export const ONETY_CRM_FUNIS = [
  { id: 598, name: 'Tráfego Pago', faseLeadId: 2880, fasePropostaId: 2877 },
  { id: 583, name: 'Franqueado Cf', faseLeadId: 2827, fasePropostaId: 2798 },
  { id: 597, name: 'BNI', faseLeadId: 2874, fasePropostaId: 2871 },
  { id: 716, name: 'Workshop - Método Mei Lucrativo', faseLeadId: 3482, fasePropostaId: 3479 },
  { id: 807, name: 'Funil De Captação - Evento Dna Contábil', faseLeadId: 3951, fasePropostaId: 3948 },
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
    ready: hasCrmFases(f),
    crmEnabled: hasCrmFases(f),
    faseLeadId: f.faseLeadId,
    fasePropostaId: f.fasePropostaId,
  })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

export const funilRequiresCrmPrep = (funilId) => {
  const funil = getFunilById(funilId)
  if (!funil) return false
  return hasCrmFases(funil)
}
