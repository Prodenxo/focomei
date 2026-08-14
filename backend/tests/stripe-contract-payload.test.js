import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildStripeContratoPayload,
  mergeSignatarioProfiles,
  validateContratoPayload,
} from '../src/services/stripe-contract-payload.service.js'

describe('stripe-contract-payload', () => {
  it('monta JSON no formato Onety', () => {
    const payload = buildStripeContratoPayload({
      empresa: {
        razao_social: 'ANDREO ASSESSORIA CONTABIL LTDA',
        cnpj: '02.899.404/0001-94',
        email: 'andreo@andreocontabil.com.br',
        telefone: '(11) 96110-2292',
        logradouro: 'Rua Exemplo',
        numero: '100',
        complemento: 'Sala 2',
        bairro: 'Centro',
        cidade: 'São Paulo',
        estado: 'sp',
        cep: '01000-000',
      },
      signatario: {
        email: 'andreo@andreocontabil.com.br',
        phone: '5511961102292',
        raw_user_meta_data: {
          full_name: 'CARLOS ALEXANDRE ANDREO',
          cpf: '134.146.328-10',
        },
      },
      meiSlots: 5,
      valorMensal: 100,
    })

    assert.deepEqual(payload, {
      contratos: [
        {
          tipo_cliente: 'empresa',
          razao_social: 'ANDREO ASSESSORIA CONTABIL LTDA',
          cpf_cnpj: '02899404000194',
          email: 'andreo@andreocontabil.com.br',
          telefone: '5511961102292',
          endereco: 'Rua Exemplo',
          numero: '100',
          complemento: 'Sala 2',
          bairro: 'Centro',
          cidade: 'São Paulo',
          estado: 'SP',
          cep: '01000000',
          signatario_nome: 'CARLOS ALEXANDRE ANDREO',
          signatario_cpf: '134.146.328-10',
          signatario_email: 'andreo@andreocontabil.com.br',
          signatario_telefone: '5511961102292',
          quantidade_licencas: '5',
          valor_mensal: 100,
        },
      ],
    })
  })

  it('rejeita contrato sem CPF do signatário', () => {
    const payload = buildStripeContratoPayload({
      empresa: {
        razao_social: 'CF ALIANCA LTDA',
        cnpj: '48221799000172',
        email: 'contato@cfalianca.com.br',
      },
      signatario: {
        email: 'contato@cfalianca.com.br',
        raw_user_meta_data: { full_name: 'Danilo Miguel' },
      },
      meiSlots: 5,
      valorMensal: 100,
    })

    const errors = validateContratoPayload(payload)
    assert.ok(errors.some((e) => e.includes('CPF do signatário')))
  })

  it('mergeSignatarioProfiles herda CPF do admin quando owner não tem', () => {
    const merged = mergeSignatarioProfiles(
      {
        email: 'owner@empresa.com',
        raw_user_meta_data: { full_name: 'Sócio sem CPF' },
      },
      {
        email: 'contato@cfalianca.com.br',
        raw_user_meta_data: { full_name: 'Danilo Miguel', cpf: '96232137515' },
      },
    )

    const payload = buildStripeContratoPayload({
      empresa: { razao_social: 'CF ALIANCA LTDA', cnpj: '48221799000172' },
      signatario: merged,
      meiSlots: 5,
    })

    assert.equal(payload.contratos[0].signatario_cpf, '962.321.375-15')
    assert.equal(payload.contratos[0].signatario_email, 'owner@empresa.com')
  })
})
