import type { Href } from 'expo-router'
import {
  fetchMeiBillingStatus,
  type MeiBillingPhase,
  type MeiBillingStatus,
} from '@/services/billingService'
import {
  MEI_AWAITING_CONTRACT_ROUTE,
  MEI_BILLING_PLANS_ROUTE,
} from '@/lib/settingsRoutes'
import { useAuthStore } from '@/store/authStore'

export type { MeiBillingPhase }

function inferMeiBillingPhase (status: MeiBillingStatus): MeiBillingPhase {
  if (status.phase) return status.phase
  if (status.required === false) return 'ok'
  if (
    status.contract?.lineId
    || status.contract?.contratoOnetyId
    || status.contract?.signingUrl
  ) {
    return 'aguardando_contrato'
  }
  return 'planos'
}

function normalizeMeiBillingStatus (status: MeiBillingStatus): MeiBillingStatus {
  return { ...status, phase: inferMeiBillingPhase(status) }
}

/**
 * Admin sem MEI liberado precisa de /planos ou /aguardando-contrato.
 */
export async function fetchMeiBillingGateStatus (): Promise<MeiBillingStatus> {
  const { role, mei } = useAuthStore.getState()
  if (role === 'superadmin') {
    return { required: false, phase: 'ok', maxMei: null, hasActiveSubscription: true }
  }
  if (role !== 'admin') {
    return { required: false, phase: 'ok', maxMei: null, hasActiveSubscription: false }
  }

  try {
    const status = await fetchMeiBillingStatus()
    return normalizeMeiBillingStatus(status)
  } catch {
    return {
      required: mei !== true,
      phase: mei !== true ? 'planos' : 'ok',
      maxMei: null,
      hasActiveSubscription: false,
    }
  }
}

export async function shouldRequireMeiBillingRoute (): Promise<boolean> {
  const status = await fetchMeiBillingGateStatus()
  return status.phase !== 'ok'
}

export async function resolveMeiBillingPhase (): Promise<MeiBillingPhase> {
  const status = await fetchMeiBillingGateStatus()
  return status.phase ?? (status.required ? 'planos' : 'ok')
}

/** Rota correta do gate MEI (planos vs aguardando contrato). */
export async function resolveMeiBillingHref (): Promise<Href | null> {
  const phase = await resolveMeiBillingPhase()
  if (phase === 'aguardando_contrato') return MEI_AWAITING_CONTRACT_ROUTE as Href
  if (phase === 'planos') return MEI_BILLING_PLANS_ROUTE as Href
  return null
}
