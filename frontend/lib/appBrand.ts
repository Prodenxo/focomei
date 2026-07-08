import { Platform } from 'react-native'
import { getPublicEnv } from './runtimeEnv'

/** Nome oficial da marca (Manual da Marca FocoMEI v1.0). */
export const APP_BRAND_NAME = 'FocoMEI'

export const APP_BRAND_TAGLINE =
  'Nosso sistema cuida do MEI. Você cuida do lucro.'

/** Label da aba/tela principal (área fiscal MEI). */
export const APP_NAV_HOME_LABEL = 'Meu MEI'

export function getAppPublicOrigin (): string {
  const fromEnv = getPublicEnv('EXPO_PUBLIC_INVITE_APP_BASE_URL').replace(/\/$/, '')
  if (fromEnv) return fromEnv
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

export function appPublicUrl (path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const origin = getAppPublicOrigin()
  if (origin) return `${origin}${normalized}`
  return normalized
}
