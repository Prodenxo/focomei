import React, { useMemo } from 'react'
import { Linking, StyleSheet, Text, type TextStyle } from 'react-native'

type Props = {
  value: string
  style?: TextStyle | TextStyle[]
  linkColor: string
  codeColor: string
}

export type SupportTextToken = {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
  href?: string
}

export type SupportTextLine = {
  bullet: boolean
  tokens: SupportTextToken[]
}

type Token = SupportTextToken

const URL_RE = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/g
const INLINE_RE = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`)/g

/** Markdown reduzido ao que aparece em conversa de suporte: negrito, itálico, código e link. */
function tokenizeLine (line: string): Token[] {
  const tokens: Token[] = []

  for (const chunk of line.split(INLINE_RE)) {
    if (!chunk) continue

    if (chunk.startsWith('**') && chunk.endsWith('**')) {
      tokens.push({ text: chunk.slice(2, -2), bold: true })
      continue
    }
    if (chunk.startsWith('__') && chunk.endsWith('__')) {
      tokens.push({ text: chunk.slice(2, -2), bold: true })
      continue
    }
    if (chunk.startsWith('`') && chunk.endsWith('`')) {
      tokens.push({ text: chunk.slice(1, -1), code: true })
      continue
    }
    if (
      (chunk.startsWith('*') && chunk.endsWith('*'))
      || (chunk.startsWith('_') && chunk.endsWith('_'))
    ) {
      tokens.push({ text: chunk.slice(1, -1), italic: true })
      continue
    }

    for (const part of chunk.split(URL_RE)) {
      if (!part) continue
      if (URL_RE.test(part)) {
        URL_RE.lastIndex = 0
        tokens.push({ text: part, href: part })
      } else {
        tokens.push({ text: part })
      }
    }
  }

  return tokens
}

export function parseSupportText (value: string): SupportTextLine[] {
  const normalized = String(value || '').replace(/\r\n/g, '\n')
  return normalized.split('\n').map((line) => {
    const bullet = /^\s*[-*•]\s+/.test(line)
    return {
      bullet,
      tokens: tokenizeLine(bullet ? line.replace(/^\s*[-*•]\s+/, '') : line),
    }
  })
}

export function SupportRichText ({ value, style, linkColor, codeColor }: Props) {
  const lines = useMemo(() => parseSupportText(value), [value])

  return (
    <Text style={style}>
      {lines.map((line, lineIndex) => (
        <Text key={lineIndex}>
          {lineIndex > 0 ? '\n' : null}
          {line.bullet ? '•  ' : null}
          {line.tokens.map((token, tokenIndex) => {
            if (token.href) {
              return (
                <Text
                  key={tokenIndex}
                  style={[styles.link, { color: linkColor }]}
                  accessibilityRole="link"
                  onPress={() => { void Linking.openURL(token.href as string) }}
                >
                  {token.text}
                </Text>
              )
            }
            return (
              <Text
                key={tokenIndex}
                style={[
                  token.bold && styles.bold,
                  token.italic && styles.italic,
                  token.code && [styles.code, { color: codeColor }],
                ]}
              >
                {token.text}
              </Text>
            )
          })}
        </Text>
      ))}
    </Text>
  )
}

const styles = StyleSheet.create({
  bold: { fontWeight: '800' },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: 'monospace', fontSize: 13 },
  link: { textDecorationLine: 'underline' },
})
