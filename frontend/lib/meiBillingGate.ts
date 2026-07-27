import { fetchMeiBillingStatus } from '@/services/billingService'
import { useAuthStore } from '@/store/authStore'

/**
 * Admin sem MEI pago precisa de /planos.
 *
 * Fonte da verdade: `GET /billing/mei/status` (`required`).
 * NÃO usar `mei===false` para forçar /planos quando a empresa já tem
 * max_mei/assinatura — admins de escritório (mei=false) entram em loop
 * planos ↔ app.
 */
export async function shouldRequireMeiBillingRoute (): Promise<boolean> {
  const { role, mei } = useAuthStore.getState()
  if (role === 'superadmin') return false
  if (role !== 'admin') return false

  try {
    const status = await fetchMeiBillingStatus()
    if (status?.required === true) return true
    if (status?.required === false) return false
    // Resposta incompleta: fail-closed só para admin sem flag MEI
    return mei !== true
  } catch {
    // Fail-closed para admin sem MEI: manda escolher plano em vez de entrar no app vazio
    return mei !== true
  }
}
