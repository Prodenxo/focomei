import {
  extrairNomeClienteDaNota,
  extrairValorDaNota,
  resolverTituloNotaFiscal,
} from '../notaFiscalDisplay'
import type { NfseRecord } from '../../services/meiNotasService'

describe('notaFiscalDisplay', () => {
  it('mostra nome do cliente como título', () => {
    const nota = {
      id: 'abc',
      user_id: 'u1',
      document_type: 'NFE',
      payload_json: {
        destinatario: { razaoSocial: 'Mlopes Comercio' },
      },
    } as NfseRecord

    expect(resolverTituloNotaFiscal(nota)).toBe('Mlopes Comercio')
    expect(extrairNomeClienteDaNota(nota)).toBe('Mlopes Comercio')
  })

  it('extrai valor de NF-e pelos pagamentos', () => {
    const nota = {
      id: 'abc',
      user_id: 'u1',
      document_type: 'NFE',
      payload_json: {
        itens: [{ valor: 250 }],
        pagamentos: [{ valor: 250 }],
      },
    } as NfseRecord

    expect(extrairValorDaNota(nota)).toBe(250)
  })

  it('fallback do título para id_integracao', () => {
    const nota = {
      id: 'abc',
      user_id: 'u1',
      id_integracao: 'mei-123',
      payload_json: {},
    } as NfseRecord

    expect(resolverTituloNotaFiscal(nota)).toBe('mei-123')
  })
})
