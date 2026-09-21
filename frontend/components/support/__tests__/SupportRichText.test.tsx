import { parseSupportText } from '../SupportRichText'

const tokensOf = (value: string) => parseSupportText(value).flatMap((line) => line.tokens)

describe('parseSupportText', () => {
  it('reconhece negrito, itálico e código na mesma linha', () => {
    expect(tokensOf('Erro **grave** no *DAS* use `npm test`')).toEqual([
      { text: 'Erro ' },
      { text: 'grave', bold: true },
      { text: ' no ' },
      { text: 'DAS', italic: true },
      { text: ' use ' },
      { text: 'npm test', code: true },
    ])
  })

  it('aceita __negrito__ e _itálico_', () => {
    expect(tokensOf('__forte__ e _leve_')).toEqual([
      { text: 'forte', bold: true },
      { text: ' e ' },
      { text: 'leve', italic: true },
    ])
  })

  it('transforma URL em link sem levar a pontuação final junto', () => {
    expect(tokensOf('veja https://focomei.com.br/ajuda, por favor')).toEqual([
      { text: 'veja ' },
      { text: 'https://focomei.com.br/ajuda', href: 'https://focomei.com.br/ajuda' },
      { text: ', por favor' },
    ])
  })

  it('marca linhas de lista e preserva as demais quebras', () => {
    expect(parseSupportText('Passos:\n- abrir o app\n- emitir a nota')).toEqual([
      { bullet: false, tokens: [{ text: 'Passos:' }] },
      { bullet: true, tokens: [{ text: 'abrir o app' }] },
      { bullet: true, tokens: [{ text: 'emitir a nota' }] },
    ])
  })

  it('não interpreta asterisco solto como formatação', () => {
    expect(tokensOf('2 * 3 = 6')).toEqual([{ text: '2 * 3 = 6' }])
  })

  it('devolve uma linha vazia para texto vazio', () => {
    expect(parseSupportText('')).toEqual([{ bullet: false, tokens: [] }])
  })
})
