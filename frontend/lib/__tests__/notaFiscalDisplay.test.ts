import {
  extrairNomeClienteDaNota,
  extrairValorDaNota,
  buildClienteCatalogByDocumento,
  resolverTituloNotaFiscal,
  formatNotaFiscalEmissaoMeta,
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

  it('extrai cliente e valor de NFSe importada da PlugNotas (tomador string)', () => {
    const nota = {
      id: 'abc',
      user_id: 'u1',
      document_type: 'NFSE',
      response_json: {
        tomador: '18189174000160',
        valorServico: 10.5,
        situacao: 'CONCLUIDO',
      },
      payload_json: {
        tomador: { cpfCnpj: '18189174000160', razaoSocial: 'Empresa Exemplo LTDA' },
        valorServico: 10.5,
        servico: [{ valor: { servico: 10.5 } }],
      },
    } as NfseRecord

    expect(extrairNomeClienteDaNota(nota)).toBe('Empresa Exemplo LTDA')
    expect(extrairValorDaNota(nota)).toBe(10.5)
  })

  it('formata CNPJ quando tomador vem só como documento', () => {
    const nota = {
      id: 'abc',
      user_id: 'u1',
      document_type: 'NFSE',
      response_json: {
        tomador: '18189174000160',
        valorServico: 250,
      },
    } as NfseRecord

    expect(extrairNomeClienteDaNota(nota)).toBeNull()
    expect(extrairValorDaNota(nota)).toBe(250)
  })

  it('resolve nome pelo catálogo de clientes quando a nota só tem documento', () => {
    const catalog = buildClienteCatalogByDocumento([
      { documento: '18189174000160', nome: 'Empresa Exemplo LTDA' },
    ])
    const nota = {
      id: 'abc',
      user_id: 'u1',
      document_type: 'NFSE',
      cnpj_tomador: '18189174000160',
      response_json: {
        tomador: '18189174000160',
        valorServico: 250,
      },
    } as NfseRecord

    expect(extrairNomeClienteDaNota(nota, catalog)).toBe('Empresa Exemplo LTDA')
  })

  it('formatNotaFiscalEmissaoMeta usa dataAutorizacao em retorno, não created_at', () => {
    const nota = {
      id: 'abc',
      user_id: 'u1',
      status: 'concluido',
      created_at: '2026-06-07T00:00:00.000Z',
      response_json: {
        status: 'PROCESSANDO',
        retorno: {
          situacao: 'AUTORIZADA',
          dataAutorizacao: '2026-08-07T21:00:00.000Z',
        },
      },
    } as NfseRecord

    const meta = formatNotaFiscalEmissaoMeta(nota)
    expect(meta).toMatch(/^Emitida em /)
    expect(meta).toContain('07/08/2026')
    expect(meta).not.toContain('07/06/2026')
  })

  it('formatNotaFiscalEmissaoMeta ignora dataEmissao (competência) sem dataAutorizacao', () => {
    const nota = {
      id: 'abc',
      user_id: 'u1',
      status: 'concluido',
      created_at: '2026-06-07T00:00:00.000Z',
      id_integracao: 'mei-4fbe702b-6c3c-4e07-a901-2a2aba3aa32f-1786038687223-1335a434',
      response_json: {
        status: 'CONCLUIDO',
        dataEmissao: '2026-06-07T21:00:00.000Z',
      },
    } as NfseRecord

    const meta = formatNotaFiscalEmissaoMeta(nota)
    expect(meta).toMatch(/^Emitida em /)
    expect(meta).toContain('06/08/2026')
    expect(meta).not.toContain('07/06/2026')
  })

  it('formatNotaFiscalEmissaoMeta usa created_at quando backend já alinhou', () => {
    const nota = {
      id: 'abc',
      user_id: 'u1',
      status: 'concluido',
      created_at: '2026-08-07T21:00:00.000Z',
      response_json: { status: 'CONCLUIDO' },
    } as NfseRecord

    const meta = formatNotaFiscalEmissaoMeta(nota)
    expect(meta).toContain('Emitida em')
    expect(meta).toContain('07/08/2026')
  })
})
