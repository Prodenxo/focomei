/** Helpers e textos do fluxo NF-e interestadual (sem motor externo). */

export function normalizeUf(value: string | null | undefined): string {
  return String(value || '').trim().toUpperCase().slice(0, 2)
}

/** Código IBGE UF (2 dígitos) → sigla. Município = UF(2) + município(5). */
const IBGE_UF_BY_PREFIX: Record<string, string> = {
  '11': 'RO',
  '12': 'AC',
  '13': 'AM',
  '14': 'RR',
  '15': 'PA',
  '16': 'AP',
  '17': 'TO',
  '21': 'MA',
  '22': 'PI',
  '23': 'CE',
  '24': 'RN',
  '25': 'PB',
  '26': 'PE',
  '27': 'AL',
  '28': 'SE',
  '29': 'BA',
  '31': 'MG',
  '32': 'ES',
  '33': 'RJ',
  '35': 'SP',
  '41': 'PR',
  '42': 'SC',
  '43': 'RS',
  '50': 'MS',
  '51': 'MT',
  '52': 'GO',
  '53': 'DF',
}

/**
 * Deriva UF a partir do código IBGE do município (7 dígitos).
 * Ex.: 3544301 → SP; 3304557 → RJ.
 */
export function ufFromIbgeCodigo(codigoIbge: string | null | undefined): string {
  const digits = String(codigoIbge || '').replace(/\D/g, '')
  if (digits.length < 2) return ''
  return IBGE_UF_BY_PREFIX[digits.slice(0, 2)] || ''
}

/** Preferência: campo UF; se vazio, infere pelo IBGE. */
export function resolveDestinatarioUf(input: {
  estado?: string | null
  codigoCidade?: string | null
}): string {
  const fromField = normalizeUf(input.estado)
  if (fromField.length === 2) return fromField
  return normalizeUf(ufFromIbgeCodigo(input.codigoCidade))
}

export function isInterestadualSale(
  emitenteUf: string | null | undefined,
  destinatarioUf: string | null | undefined,
): boolean {
  const origem = normalizeUf(emitenteUf)
  const destino = normalizeUf(destinatarioUf)
  if (origem.length !== 2 || destino.length !== 2) return false
  return origem !== destino
}

export function toInterestadualCfop(cfopInterno: string): string {
  const c = String(cfopInterno || '').replace(/\D/g, '').slice(0, 4)
  if (c.length !== 4) return '6102'
  if (c.startsWith('5')) return `6${c.slice(1)}`
  if (c.startsWith('6')) return c
  return '6102'
}

export const INTERESTADUAL_CONSENT_CODE = 'NFE_INTERESTADUAL_CONSENT_REQUIRED'
export const INTERESTADUAL_TAX_CODE = 'NFE_INTERESTADUAL_TAX_REQUIRED'
