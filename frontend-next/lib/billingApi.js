import { apiClient } from '@/lib/apiClient';

export async function fetchMeiBillingStatus() {
  return apiClient.get('/billing/mei/status');
}

export async function createSelfServeMeiCheckout(meiSlots) {
  return apiClient.post('/billing/mei/checkout', {
    meiSlots,
    billingTiming: 'checkout',
  });
}

export async function confirmSelfServeMeiPlan(meiSlots) {
  return apiClient.post('/billing/mei/confirm-plan', { meiSlots });
}

export async function refreshMeiContractSignature() {
  return apiClient.post('/billing/mei/contrato/refresh-signature', {});
}
