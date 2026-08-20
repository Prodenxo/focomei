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
import {
  hasMeiContractPendingSession,
  readMeiContractPendingSession,
  clearMeiContractPendingSession,
} from '@/lib/meiContractPendingSession'
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

async function mergePendingContractSession (
  status: MeiBillingStatus,
): Promise<MeiBillingStatus> {
  const pending = await readMeiContractPendingSession()
  if (!hasMeiContractPendingSession(pending)) {
    if (status.phase === 'ok' || !status.required) {
      await clearMeiContractPendingSession()
    }
    return status
  }

  if (status.phase === 'ok' || status.hasActiveSubscription) {
    await clearMeiContractPendingSession()
    return status
  }

  return normalizeMeiBillingStatus({
    ...status,
    required: true,
    phase: 'aguardando_contrato',
    contract: {
      lineId: pending?.lineId ?? status.contract?.lineId,
      signingUrl: pending?.signingUrl ?? status.contract?.signingUrl ?? null,
      contratoOnetyId: pending?.contratoOnetyId ?? status.contract?.contratoOnetyId ?? null,
      contratoStatus: status.contract?.contratoStatus ?? 'awaiting_signature',
      meiSlots: status.contract?.meiSlots ?? null,
    },
  })
}

async function statusFromPendingSession (): Promise<MeiBillingStatus | null> {
  const pending = await readMeiContractPendingSession()
  if (!hasMeiContractPendingSession(pending)) return null
  return {
    required: true,
    phase: 'aguardando_contrato',
    maxMei: 0,
    hasActiveSubscription: false,
    contract: {
      lineId: pending?.lineId,
      signingUrl: pending?.signingUrl ?? null,
      contratoOnetyId: pending?.contratoOnetyId ?? null,
      contratoStatus: 'awaiting_signature',
    },
  }
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
    return mergePendingContractSession(normalizeMeiBillingStatus(status))
  } catch {
    const fromSession = await statusFromPendingSession()
    if (fromSession) return fromSession
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
