import { query } from '../config/pg.js';
import { env } from '../config/env.js';

/** @type {boolean | null} */
let approvalColumnsSupported = null;

const isLocalAuthMode = () =>
  String(env.AUTH_MODE || '').trim().toLowerCase() === 'local';

const APPROVAL_COLUMN_NAMES = [
  'approved_at',
  'approved_by',
  'contrato_status',
  'contrato_sent_at',
  'contrato_error',
  'contrato_signing_url',
  'contrato_onety_id',
  'onety_funil_id',
  'onety_lead_id',
  'contrato_client_signed_at',
];

export const isMissingApprovalColumnError = (error) => {
  const msg = String(error?.message || error || '').toLowerCase();
  return APPROVAL_COLUMN_NAMES.some((col) => msg.includes(col) && msg.includes('does not exist'));
};

/**
 * Detecta se a migration de rastreio PIX/contrato já foi aplicada.
 * Cache em memória — reinicie o processo após rodar a migration.
 */
export const hasMeiLineApprovalColumns = async (adminClient) => {
  if (approvalColumnsSupported !== null) return approvalColumnsSupported;

  if (isLocalAuthMode() || env.DATABASE_URL || env.SUPABASE_DB_URL) {
    try {
      const { rows } = await query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'empresa_mei_subscription_lines'
           AND column_name = 'approved_at'
         LIMIT 1`,
      );
      approvalColumnsSupported = Boolean(rows[0]);
      return approvalColumnsSupported;
    } catch {
      approvalColumnsSupported = false;
      return false;
    }
  }

  try {
    const { error } = await adminClient
      .from('empresa_mei_subscription_lines')
      .select('approved_at')
      .limit(1);
    approvalColumnsSupported = !error || !isMissingApprovalColumnError(error);
  } catch {
    approvalColumnsSupported = false;
  }

  return approvalColumnsSupported;
};

/** @param {Record<string, unknown>} payload */
export const stripMeiLineApprovalFields = (payload) => {
  const next = { ...payload };
  for (const key of APPROVAL_COLUMN_NAMES) {
    delete next[key];
  }
  return next;
};

/**
 * @param {Record<string, unknown>} corePayload
 * @param {Record<string, unknown>} [approvalExtras]
 */
export const buildMeiLineInsertPayload = async (adminClient, corePayload, approvalExtras = {}) => {
  const supported = await hasMeiLineApprovalColumns(adminClient);
  if (!supported) return corePayload;
  return { ...corePayload, ...approvalExtras };
};

/**
 * @param {import('../config/pgSupabaseCompat.js').createPgServiceClient extends Function ? ReturnType<import('../config/pgSupabaseCompat.js').createPgServiceClient> : any} adminClient
 * @param {Record<string, unknown>} payload
 */
export const insertMeiSubscriptionLine = async (adminClient, payload) => {
  let { data, error } = await adminClient
    .from('empresa_mei_subscription_lines')
    .insert(payload)
    .select()
    .maybeSingle();

  if (!error) return data;
  if (isMissingApprovalColumnError(error)) {
    approvalColumnsSupported = false;
    ({ data, error } = await adminClient
      .from('empresa_mei_subscription_lines')
      .insert(stripMeiLineApprovalFields(payload))
      .select()
      .maybeSingle());
    if (!error) return data;
  }

  throw error;
};

/**
 * @param {import('../config/pgSupabaseCompat.js').createPgServiceClient extends Function ? ReturnType<import('../config/pgSupabaseCompat.js').createPgServiceClient> : any} adminClient
 * @param {string} lineId
 * @param {Record<string, unknown>} patch
 */
export const updateMeiSubscriptionLine = async (adminClient, lineId, patch) => {
  let { data, error } = await adminClient
    .from('empresa_mei_subscription_lines')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', lineId)
    .select()
    .maybeSingle();

  if (!error) return data;
  if (isMissingApprovalColumnError(error)) {
    approvalColumnsSupported = false;
    ({ data, error } = await adminClient
      .from('empresa_mei_subscription_lines')
      .update({ ...stripMeiLineApprovalFields(patch), updated_at: new Date().toISOString() })
      .eq('id', lineId)
      .select()
      .maybeSingle());
    if (!error) return data;
  }

  throw error;
};

/** Invalida cache após migration manual (opcional). */
export const resetMeiLineApprovalColumnsCache = () => {
  approvalColumnsSupported = null;
};
