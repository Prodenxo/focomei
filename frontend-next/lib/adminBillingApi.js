import { apiClient } from '@/lib/apiClient';

const queryString = (values) => {
  const params = new URLSearchParams();
  Object.entries(values || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      params.set(key, String(value).trim());
    }
  });
  const query = params.toString();
  return query ? `?${query}` : '';
};

export function listMeiPaymentApprovals(filters = {}) {
  return apiClient.get(`/admin/billing/payment-approvals${queryString(filters)}`);
}

export function listStripeMeiSubscriptionLines(empresaId) {
  return apiClient.get(
    `/admin/billing/stripe/subscription-lines${queryString({ empresaId })}`,
  );
}

export function createMeiStripeCheckout(input) {
  return apiClient.post('/admin/billing/stripe/mei-checkout', input);
}

export function syncMaxMeiFromStripeLines(empresaId) {
  return apiClient.post('/admin/billing/stripe/sync-max-mei', { empresaId });
}

export function reconcileStripeMeiPayment(input) {
  return apiClient.post('/admin/billing/stripe/reconcile-payment', input, {
    timeoutMs: 30000,
  });
}

export function emitStripeMeiContrato(input) {
  return apiClient.post('/admin/billing/stripe/emit-contrato', input, {
    timeoutMs: 30000,
  });
}

export function listOnetyCrmFunis() {
  return apiClient.get('/admin/billing/onety-crm/funis');
}

export function confirmPixMeiPayment(input) {
  return apiClient.post('/admin/billing/pix/confirm-payment', input, {
    timeoutMs: 30000,
  });
}

export function cancelMeiSubscriptionLine(input) {
  return apiClient.post('/admin/billing/mei-subscription-lines/cancel', input);
}

export function getContratoSignatario(empresaId) {
  return apiClient.get(
    `/admin/billing/contrato-signatario${queryString({ empresaId })}`,
  );
}
