import {
  applyCatalogClienteToNfeForm,
  applyCatalogClienteToNfseForm,
  buildCatalogClienteMetadataJson,
  catalogClienteHasNfeEndereco,
  catalogClienteHasTomadorEndereco,
  formatTelefoneLookup,
  parseCatalogClienteFiscalMeta,
  validateCatalogClienteNfeFields,
} from '../meiCatalogClienteFiscal'
import { getDefaultNfeDestinatarioEndereco } from '../meiNfseForms'
import { DEFAULT_DESTINATARIO_IND_IE_DEST } from '../meiNfeDestinatarioIe'
import type { NfseCatalogCliente } from '../../services/meiNotasService'

describe('meiCatalogClienteFiscal', () => {
  it('detecta cliente NF-e sem endereço completo', () => {
    const item: NfseCatalogCliente = {
      id: '1',
      document_type: 'NFE',
      documento: '01858368000158',
      nome: 'Condomínio',
      email: 'a@b.com',
      metadata_json: null,
    }
    expect(catalogClienteHasNfeEndereco(item)).toBe(false)
  })

  it('aplica metadata do catálogo ao formulário NF-e', () => {
    const item: NfseCatalogCliente = {
      id: '1',
      document_type: 'NFE',
      documento: '01858368000158',
      nome: 'Condomínio Enseada',
      email: 'mardonortec@gmail.com',
      metadata_json: buildCatalogClienteMetadataJson({
        indIEDest: '9',
        endereco: {
          ...getDefaultNfeDestinatarioEndereco(),
          cep: '59082000',
          logradouro: 'Rua X',
          numero: '100',
          bairro: 'Centro',
          codigoCidade: '2408102',
          descricaoCidade: 'Natal',
          estado: 'RN',
        },
      }),
    }
    expect(catalogClienteHasNfeEndereco(item)).toBe(true)
    const prefill = applyCatalogClienteToNfeForm(item)
    expect(prefill.destinatarioIndIEDest).toBe('9')
    expect(prefill.destinatarioEndereco.codigoCidade).toBe('2408102')
    expect(parseCatalogClienteFiscalMeta(item.metadata_json).indIEDest).toBe('9')
  })

  it('exige endereço ao cadastrar cliente NF-e', () => {
    expect(
      validateCatalogClienteNfeFields('NFE', getDefaultNfeDestinatarioEndereco()),
    ).toMatch(/CEP/)
    expect(validateCatalogClienteNfeFields('NFSE', getDefaultNfeDestinatarioEndereco())).toBeNull()
  })

  it('aplica metadata do catálogo ao formulário NFS-e', () => {
    const item: NfseCatalogCliente = {
      id: '2',
      document_type: 'NFSE',
      documento: '38852157000118',
      nome: 'Tomador NFS-e',
      email: 'tomador@exemplo.com',
      metadata_json: buildCatalogClienteMetadataJson({
        endereco: {
          ...getDefaultNfeDestinatarioEndereco(),
          cep: '01310100',
          logradouro: 'Av Paulista',
          numero: '1000',
          bairro: 'Bela Vista',
          codigoCidade: '3550308',
          descricaoCidade: 'São Paulo',
          estado: 'SP',
        },
      }),
    }
    expect(catalogClienteHasTomadorEndereco(item)).toBe(true)
    const prefill = applyCatalogClienteToNfseForm(item)
    expect(prefill.tomadorEmail).toBe('tomador@exemplo.com')
    expect(prefill.tomadorEndereco.descricaoCidade).toBe('São Paulo')
  })

  it('guarda inscrição municipal e telefone no cadastro e devolve na emissão', () => {
    const metadata_json = buildCatalogClienteMetadataJson({
      inscricaoMunicipal: ' 123456/001 ',
      telefone: ' (41) 99999-8888 ',
      endereco: getDefaultNfeDestinatarioEndereco(),
    })
    expect(metadata_json?.inscricaoMunicipal).toBe('123456/001')
    expect(metadata_json?.telefone).toBe('(41) 99999-8888')

    const meta = parseCatalogClienteFiscalMeta(metadata_json)
    expect(meta.inscricaoMunicipal).toBe('123456/001')
    expect(meta.telefone).toBe('(41) 99999-8888')

    const prefill = applyCatalogClienteToNfseForm({
      id: '1',
      document_type: 'NFSE',
      documento: '98765432000188',
      nome: 'Cliente LTDA',
      metadata_json,
    })
    expect(prefill.tomadorInscricaoMunicipal).toBe('123456/001')
    expect(prefill.tomadorTelefone).toBe('(41) 99999-8888')
  })

  it('cliente antigo sem os campos novos continua válido', () => {
    const meta = parseCatalogClienteFiscalMeta({ indIEDest: '9' })
    expect(meta.inscricaoMunicipal).toBeUndefined()
    expect(meta.telefone).toBeUndefined()

    const prefill = applyCatalogClienteToNfseForm({
      id: '1',
      document_type: 'NFSE',
      documento: '98765432000188',
      nome: 'Cliente Antigo',
      metadata_json: { indIEDest: '9' },
    })
    expect(prefill.tomadorInscricaoMunicipal).toBe('')
    expect(prefill.tomadorTelefone).toBe('')
  })

  it('campos em branco não sujam o metadata do cadastro', () => {
    const metadata_json = buildCatalogClienteMetadataJson({
      inscricaoMunicipal: '   ',
      telefone: '',
      endereco: getDefaultNfeDestinatarioEndereco(),
    })
    expect(metadata_json?.inscricaoMunicipal).toBeUndefined()
    expect(metadata_json?.telefone).toBeUndefined()
  })

  it('guarda a IE do cliente contribuinte e devolve na emissão', () => {
    const metadata_json = buildCatalogClienteMetadataJson({
      indIEDest: '1',
      inscricaoEstadual: '20.643.227-5',
      endereco: getDefaultNfeDestinatarioEndereco(),
    })
    expect(metadata_json?.inscricaoEstadual).toBe('206432275')

    const prefill = applyCatalogClienteToNfeForm({
      id: '1',
      document_type: 'NFE',
      documento: '55495135000167',
      nome: 'BARRAMARES BEACH RESTAURANTE LTDA',
      metadata_json,
    })
    expect(prefill.destinatarioIndIEDest).toBe('1')
    expect(prefill.destinatarioInscricaoEstadual).toBe('206432275')
  })

  it('IE não é gravada para quem não é contribuinte', () => {
    for (const indIEDest of ['9', '2'] as const) {
      const metadata_json = buildCatalogClienteMetadataJson({
        indIEDest,
        inscricaoEstadual: '206432275',
        endereco: getDefaultNfeDestinatarioEndereco(),
      })
      expect(metadata_json?.inscricaoEstadual).toBeUndefined()
    }
  })

  it('cliente antigo sem IE no cadastro continua válido', () => {
    const prefill = applyCatalogClienteToNfeForm({
      id: '1',
      document_type: 'NFE',
      documento: '55495135000167',
      nome: 'Cliente Antigo',
      metadata_json: { indIEDest: '9' },
    })
    expect(prefill.destinatarioInscricaoEstadual).toBe('')
  })

  it('telefone da Receita vira string editável; incompleto é ignorado', () => {
    expect(formatTelefoneLookup({ ddd: '41', numero: '999998888' })).toBe('41999998888')
    expect(formatTelefoneLookup({ ddd: '', numero: '999998888' })).toBe('')
    expect(formatTelefoneLookup(null)).toBe('')
  })
})

