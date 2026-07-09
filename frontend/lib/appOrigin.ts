import { Platform } from 'react-native'
import { getPublicEnv } from './runtimeEnv'

export type AppOrigin = 'focomei' | 'financeiro'

/** Origem do cadastro — sem SQL; gravado em `user_metadata`. */
export function resolveAppOrigin (): AppOrigin {
  const fromEnv = getPublicEnv('EXPO_PUBLIC_APP_PRODUCT').trim().toLowerCase()
  if (fromEnv === 'focomei' || fromEnv === 'financeiro') {
    return fromEnv
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase()
    if (host.includes('focomei')) return 'focomei'
    if (host.includes('meiinfinito') || host.includes('meufinanceiro')) return 'financeiro'
  }

  // App deste repositório = FocoMEI (Expo Go, build nativo, localhost dev).
  return 'focomei'
}

export function signupOriginMetadata (): Record<string, string> {
  const origin = resolveAppOrigin()
  return {
    app_origin: origin,
    product_line: origin,
  }
}
