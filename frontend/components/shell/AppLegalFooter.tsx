import React from 'react'
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { APP_BRAND_NAME } from '@/lib/appBrand'
import { brandColors } from '@/lib/brandTokens'
import { AppBrandLogo } from '@/components/shell/AppBrandLogo'
import { LegalWebLink } from '@/components/LegalWebLink'

type Props = {
  /** Estilo extra no container (ex.: marginTop no fim do scroll). */
  style?: StyleProp<ViewStyle>
  /**
   * `app` — barra fina no fim das telas (padrão).
   * `marketing` — bloco grande da landing / planos.
   */
  density?: 'app' | 'marketing'
}

/**
 * Rodapé legal (azul marca + wordmark + links + ©).
 * Só web. Fica no fim do conteúdo (fluxo do scroll) — não fixed/sticky.
 */
export function AppLegalFooter ({ style, density = 'app' }: Props) {
  if (Platform.OS !== 'web') return null

  const isMarketing = density === 'marketing'

  return (
    <View
      accessibilityRole="contentinfo"
      style={[isMarketing ? styles.rootMarketing : styles.rootApp, style]}
    >
      <View style={styles.inner}>
        <AppBrandLogo
          variant={isMarketing ? 'wordmark' : 'wordmarkCompact'}
          onDarkBackground
          height={isMarketing ? 36 : 20}
        />
        <View style={styles.links}>
          <LegalWebLink
            href="/privacidade"
            label="Política de Privacidade"
            textStyle={styles.link}
          />
          <Text style={styles.sep}>·</Text>
          <LegalWebLink
            href="/termos"
            label="Termos de Uso"
            textStyle={styles.link}
          />
        </View>
      </View>
      <View style={isMarketing ? styles.bottomMarketing : styles.bottomApp}>
        <Text style={styles.copyright}>
          © 2026 {APP_BRAND_NAME}. Todos os direitos reservados.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  rootApp: {
    width: '100%',
    backgroundColor: brandColors.primary,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  rootMarketing: {
    width: '100%',
    backgroundColor: brandColors.primary,
    paddingTop: 40,
    paddingBottom: 24,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  inner: {
    alignItems: 'center',
    gap: 10,
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  link: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.62)',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  sep: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.28)',
    fontWeight: '400',
  },
  bottomApp: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  bottomMarketing: {
    marginTop: 24,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  copyright: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    fontWeight: '400',
  },
})
