import type { Router } from 'expo-router'
import { Platform } from 'react-native'

/** Rotas de configurações — URLs reais no web (ex.: /configuracoes/solicitacoes). */
export const SETTINGS_ROUTES = {
  index: '/(app)/configuracoes',
  usuarios: '/(app)/configuracoes/usuarios',
  solicitacoes: '/(app)/configuracoes/solicitacoes',
} as const

/** Checklist pós-login (ativação guiada). */
export const ACTIVATION_ROUTE = '/(app)/ativacao' as const

/** Cadastro obrigatório de CNPJ (admin da empresa, uma vez). */
export const EMPRESA_CNPJ_ONBOARDING_ROUTE = '/(app)/empresa-cnpj' as const

/** Escolha de plano MEI + Checkout Stripe (self-serve). */
export const MEI_BILLING_PLANS_ROUTE = '/(app)/planos' as const

/** Aguardando assinatura do contrato Onety (self-serve contract_first). */
export const MEI_AWAITING_CONTRACT_ROUTE = '/(app)/aguardando-contrato' as const

export type SettingsRouteHref = (typeof SETTINGS_ROUTES)[keyof typeof SETTINGS_ROUTES]

type GoBackRouter = Pick<Router, 'back' | 'replace' | 'canGoBack'>

/**
 * Voltar sem erro GO_BACK.
 * No web, `canGoBack()` pode ser true pelo history do browser enquanto o Stack
 * do Expo Router está vazio — `back()` gera o warning. Por isso no web sempre `replace`.
 */
export function safeGoBack(
  router: GoBackRouter,
  fallbackHref: string,
): void {
  if (
    Platform.OS !== 'web'
    && typeof router.canGoBack === 'function'
    && router.canGoBack()
  ) {
    router.back()
    return
  }
  router.replace(fallbackHref as never)
}

/** Voltar sem erro GO_BACK quando não há histórico (F5 em rota profunda). */
export function goBackToSettings(router: GoBackRouter): void {
  safeGoBack(router, SETTINGS_ROUTES.index)
}
