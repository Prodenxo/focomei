import { toMeiUserErrorMessage } from '../../utils/meiUserFacingMessage'

describe('toMeiUserErrorMessage', () => {
  it('mantém o aviso de certificado vencido mesmo sendo longo', () => {
    const raw =
      'Este certificado digital venceu em 19/05/2026. Emita um novo e-CNPJ do MEI na certificadora e envie o arquivo atualizado.'
    expect(toMeiUserErrorMessage(raw)).toBe(raw)
  })

  it('mantém o aviso de certificado que ainda não vale', () => {
    const raw =
      'Este certificado digital só passa a valer em 01/10/2026. Envie o certificado que está válido hoje.'
    expect(toMeiUserErrorMessage(raw)).toBe(raw)
  })

  it('esconde mensagem técnica da Receita', () => {
    const raw = 'Termo recusado (403). O CNPJ em <destinatario papel="contratante"> deve ser SERPRO_CONTRATANTE_NUMERO'
    expect(toMeiUserErrorMessage(raw)).toBe('Não foi possível consultar agora. Tente de novo.')
  })

  it('mantém mensagem curta e simples', () => {
    expect(toMeiUserErrorMessage('CNPJ do MEI inválido')).toBe('CNPJ do MEI inválido')
  })
})
