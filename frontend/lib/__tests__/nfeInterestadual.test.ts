import {
  isInterestadualSale,
  normalizeUf,
  resolveDestinatarioUf,
  toInterestadualCfop,
  ufFromIbgeCodigo,
} from '../nfeInterestadual'

describe('nfeInterestadual helpers', () => {
  it('detecta venda interestadual', () => {
    expect(isInterestadualSale('RJ', 'SP')).toBe(true)
    expect(isInterestadualSale('rj', 'RJ')).toBe(false)
    expect(isInterestadualSale('', 'SP')).toBe(false)
  })

  it('converte CFOP interno para interestadual', () => {
    expect(toInterestadualCfop('5102')).toBe('6102')
  })

  it('normaliza UF', () => {
    expect(normalizeUf(' sp ')).toBe('SP')
  })

  it('deriva UF do código IBGE', () => {
    expect(ufFromIbgeCodigo('3544301')).toBe('SP')
    expect(ufFromIbgeCodigo('3304557')).toBe('RJ')
    expect(ufFromIbgeCodigo('35')).toBe('SP')
    expect(ufFromIbgeCodigo('123')).toBe('AC')
    expect(ufFromIbgeCodigo('99')).toBe('')
    expect(ufFromIbgeCodigo('1')).toBe('')
  })

  it('resolve UF do destinatário com fallback IBGE', () => {
    expect(resolveDestinatarioUf({ estado: 'sp', codigoCidade: '3304557' })).toBe('SP')
    expect(resolveDestinatarioUf({ estado: '', codigoCidade: '3544301' })).toBe('SP')
    expect(resolveDestinatarioUf({ estado: null, codigoCidade: null })).toBe('')
  })
})
