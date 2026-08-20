import {
  fetchMeiBillingStatus,
  type MeiBillingPhase,
  type MeiBillingStatus,
} from '@/services/billingService'
import { useAuthStore } from '@/store/authStore'

export type { MeiBillingPhase }

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
    if (status?.phase) return status
    if (status?.required === false) return { ...status, phase: 'ok' }
    return { ...status, phase: 'planos' }
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
