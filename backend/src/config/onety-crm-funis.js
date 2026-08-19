/**
 * Funis comerciais Onety (empresa 785).
 * faseLeadId / fasePropostaId: capturar via DevTools ao arrastar card Lead → Proposta.
 */
export const ONETY_EMPRESA_ID = 785

/** @type {Array<{ id: number, name: string, faseLeadId: number | null, fasePropostaId: number | null }>} */
export const ONETY_CRM_FUNIS = [
  { id: 598, name: 'Tráfego Pago', faseLeadId: null, fasePropostaId: null },
  { id: 583, name: 'Franqueado Cf', faseLeadId: null, fasePropostaId: null },
  { id: 597, name: 'BNI', faseLeadId: 2874, fasePropostaId: 2871 },
  { id: 716, name: 'Workshop - Método Mei Lucrativo', faseLeadId: null, fasePropostaId: null },
  { id: 794, name: 'Funil De Aquisição Whatsapp', faseLeadId: null, fasePropostaId: null },
  { id: 807, name: 'Funil De Captação - Evento Dna Contábil', faseLeadId: null, fasePropostaId: null },
  { id: 682, name: 'Contrio Mangaratiba', faseLeadId: null, fasePropostaId: null },
]

export const getFunilById = (funilId) => {
  const id = Number(funilId)
  if (!Number.isFinite(id)) return null
  return ONETY_CRM_FUNIS.find((f) => f.id === id) || null
}

export const listFunisDisponiveis = () =>
  ONETY_CRM_FUNIS.map((f) => ({
    id: f.id,
    name: f.name,
    ready: Boolean(f.faseLeadId && f.fasePropostaId),
    faseLeadId: f.faseLeadId,
    fasePropostaId: f.fasePropostaId,
  })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
