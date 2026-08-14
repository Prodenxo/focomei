import { apiClient } from '../lib/apiClient';

export interface StripeMeiSubscriptionLine {
  id: string;
  empresa_id: string;
  mei_slots: number;
  status: string;
  value_numeric: number;
  billing_type: string;
  external_reference?: string | null;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  stripe_subscription_id?: string | null;
  stripe_checkout_session_id?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  contrato_status?: 'pending' | 'sent' | 'failed' | 'skipped' | null;
  contrato_sent_at?: string | null;
  contrato_error?: string | null;
}

export interface MeiPaymentApprovalItem {
  lineId: string;
  empresaId: string;
  empresaName: string;
  empresaCnpj: string | null;
  meiSlots: number;
  valueNumeric: number;
  lineStatus: string;
  billingType: string;
  paymentChannel: 'pix' | 'card' | 'other';
  paymentChannelLabel: string;
  description: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  approvedByEmail: string | null;
  approvedByName: string | null;
  releasedByLabel: string;
  contratoStatus: 'pending' | 'sent' | 'failed' | 'skipped' | null;
  contratoStatusLabel: string;
  contratoSentAt: string | null;
  contratoError: string | null;
  accessReleased: boolean;
  ownerId: string | null;
  ownerEmail: string | null;
  ownerDisplayName: string | null;
  maxMei: number | null;
  legacyMeiSlotsPix: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface MeiPaymentApprovalsSummary {
  total: number;
  pix: number;
  card: number;
  accessReleased: number;
  contratoSent: number;
  contratoFailed: number;
  contratoPending: number;
}

export interface ListMeiPaymentApprovalsQuery {
  status?: 'pending' | 'active' | 'cancelled';
  paymentChannel?: 'pix' | 'card';
  contratoStatus?: 'pending' | 'sent' | 'failed' | 'skipped';
  accessReleased?: 'yes' | 'no';
  search?: string;
}

export interface ContratoSignatarioInfo {
  userId: string;
  displayName: string;
  email: string;
  cpfCadastrado: boolean;
}

export async function getContratoSignatario(
  empresaId: string,
): Promise<{ signatario: ContratoSignatarioInfo }> {
  const q = new URLSearchParams({ empresaId });
  return apiClient.get<{ signatario: ContratoSignatarioInfo }>(
    `/admin/billing/contrato-signatario?${q.toString()}`,
  );
}

export async function listMeiPaymentApprovals(
  query: ListMeiPaymentApprovalsQuery = {},
): Promise<{ items: MeiPaymentApprovalItem[]; summary: MeiPaymentApprovalsSummary }> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.paymentChannel) params.set('paymentChannel', query.paymentChannel);
  if (query.contratoStatus) params.set('contratoStatus', query.contratoStatus);
  if (query.accessReleased) params.set('accessReleased', query.accessReleased);
  if (query.search?.trim()) params.set('search', query.search.trim());
  const qs = params.toString();
  return apiClient.get<{ items: MeiPaymentApprovalItem[]; summary: MeiPaymentApprovalsSummary }>(
    `/admin/billing/payment-approvals${qs ? `?${qs}` : ''}`,
  );
}

export async function listStripeMeiSubscriptionLines(
  empresaId: string,
): Promise<{ lines: StripeMeiSubscriptionLine[] }> {
  const q = new URLSearchParams({ empresaId });
  return apiClient.get<{ lines: StripeMeiSubscriptionLine[] }>(
    `/admin/billing/stripe/subscription-lines?${q.toString()}`,
  );
}

export type BillingTimingOption = 'checkout' | 'next_cycle';

export interface CreateMeiStripeCheckoutInput {
  empresaId: string;
  meiSlots: number;
  billingTiming?: BillingTimingOption;
  description?: string;
  value?: number;
  externalReference?: string;
}

export interface CreateMeiStripeCheckoutResult {
  line: StripeMeiSubscriptionLine;
  checkoutUrl: string | null;
  billingTiming: string;
  pricing: { total: number; unit: number; tier: string };
  stripe?: { subscription: unknown };
}

export async function createMeiStripeCheckout(
  body: CreateMeiStripeCheckoutInput,
): Promise<CreateMeiStripeCheckoutResult> {
  return apiClient.post<CreateMeiStripeCheckoutResult>('/admin/billing/stripe/mei-checkout', body);
}

export async function syncMaxMeiFromStripeLines(empresaId: string): Promise<{ max_mei: number }> {
  return apiClient.post<{ max_mei: number }>('/admin/billing/stripe/sync-max-mei', { empresaId });
}

export interface ReconcileStripeMeiPaymentInput {
  empresaId?: string;
  checkoutSessionId?: string;
  stripeSubscriptionId?: string;
  emitContrato?: boolean;
}

export interface ReconcileStripeMeiPaymentResult {
  empresaId: string;
  steps: Array<Record<string, unknown>>;
  snapshot?: {
    empresa?: { id: string; status: string; max_mei: number } | null;
    lines?: StripeMeiSubscriptionLine[];
    ownerAccess?: { status: boolean; mei: boolean } | null;
  };
}

export async function reconcileStripeMeiPayment(
  body: ReconcileStripeMeiPaymentInput,
): Promise<ReconcileStripeMeiPaymentResult> {
  return apiClient.post<ReconcileStripeMeiPaymentResult>(
    '/admin/billing/stripe/reconcile-payment',
    body,
  );
}

export async function emitStripeMeiContrato(empresaId: string): Promise<unknown> {
  return apiClient.post('/admin/billing/stripe/emit-contrato', { empresaId });
}

export interface ConfirmPixMeiPaymentInput {
  empresaId: string;
  meiSlots?: number;
  description?: string;
  emitContrato?: boolean;
  externalReference?: string;
}

export interface ConfirmPixMeiPaymentResult {
  line: StripeMeiSubscriptionLine;
  maxMei: { max_mei: number };
  activated: { activated: boolean; ownerId?: string | null };
  legacy_mei_slots_pix: number;
  contrato?: { ok?: boolean; error?: string } | null;
  idempotent?: boolean;
}

export async function confirmPixMeiPayment(
  body: ConfirmPixMeiPaymentInput,
): Promise<ConfirmPixMeiPaymentResult> {
  return apiClient.post<ConfirmPixMeiPaymentResult>(
    '/admin/billing/pix/confirm-payment',
    body,
  );
}

export interface CancelMeiSubscriptionLineInput {
  empresaId: string;
  lineId: string;
}

export interface CancelMeiSubscriptionLineResult {
  lineId: string;
  cancelled: boolean;
  meiSlotsRemoved: number;
  maxMei: { max_mei: number };
  legacy_mei_slots_pix?: number | null;
}

export async function cancelMeiSubscriptionLine(
  body: CancelMeiSubscriptionLineInput,
): Promise<CancelMeiSubscriptionLineResult> {
  return apiClient.post<CancelMeiSubscriptionLineResult>(
    '/admin/billing/mei-subscription-lines/cancel',
    body,
  );
}
