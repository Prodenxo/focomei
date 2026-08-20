import { apiClient } from '../lib/apiClient'
import type { MeiPublicPackage } from '../lib/meiBillingPricing'

export type MeiBillingPhase = 'ok' | 'planos' | 'aguardando_contrato'

export interface MeiContractStatus {
  lineId?: string
  signingUrl?: string | null
  contratoOnetyId?: number | null
  contratoStatus?: string | null
  funilId?: number | null
  leadId?: number | null
  meiSlots?: number | null
}

export interface MeiBillingStatus {
  required: boolean
  phase?: MeiBillingPhase
  billingMode?: 'contract_first' | 'stripe'
  maxMei: number | null
  hasActiveSubscription: boolean
  empresaId?: string
  packages?: MeiPublicPackage[]
  selfServeFunilId?: number
  contract?: MeiContractStatus | null
}

export async function fetchMeiBillingStatus (): Promise<MeiBillingStatus> {
  return apiClient.get<MeiBillingStatus>('/billing/mei/status')
}

export async function createSelfServeMeiCheckout (
  meiSlots: number,
): Promise<{ checkoutUrl: string | null; pricing: { total: number; unit: number } }> {
  return apiClient.post('/billing/mei/checkout', {
    meiSlots,
    billingTiming: 'checkout',
  })
}

export async function confirmSelfServeMeiPlan (
  meiSlots: number,
): Promise<{
  ok: boolean
  lineId?: string
  signingUrl?: string | null
  contratoOnetyId?: number | null
  alreadyPending?: boolean
}> {
  return apiClient.post('/billing/mei/confirm-plan', { meiSlots })
}

export async function refreshMeiContractSignature (): Promise<{
  ok: boolean
  activated?: boolean
  clientSigned?: boolean
  fullySigned?: boolean
  signingUrl?: string | null
  contratoOnetyId?: number | null
}> {
  return apiClient.post('/billing/mei/contrato/refresh-signature', {})
}
