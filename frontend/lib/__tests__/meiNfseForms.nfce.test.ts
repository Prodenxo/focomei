import {
  buildNfeLikePayloadFromForm,
  getDefaultNfeLikeForm,
  getNfeLikeValidationMessage,
} from '../meiNfseForms'

function validNfceForm() {
  const form = getDefaultNfeLikeForm()
  form.emitenteCpfCnpj = '67593254000131'
  form.itens[0] = {
    ...form.itens[0],
    codigo: '1',
    descricao: 'Produto',
    ncm: '12345678',
    cfop: '5102',
    unidade: 'UN',
    quantidade: '1',
    valorUnitario: '10',
  }
  return form
}

describe('NFC-e com consumidor não identificado', () => {
  it('não exige CPF/CNPJ do cliente', () => {
    expect(getNfeLikeValidationMessage(validNfceForm(), 'NFCE')).toBeNull()
  })

  it('não envia destinatário no payload fiscal', () => {
    const payload = buildNfeLikePayloadFromForm(validNfceForm(), 'NFCE')
    expect(payload.destinatario).toBeUndefined()
  })
})
