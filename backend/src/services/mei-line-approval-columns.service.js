import { query } from '../config/pg.js';
import { env } from '../config/env.js';

/** @type {boolean | null} */
let approvalColumnsSupported = null;

/** @type {boolean | null} */
let contractLinkColumnsSupported = null;

const isLocalAuthMode = () =>
  String(env.AUTH_MODE || '').trim().toLowerCase() === 'local';

const APPROVAL_COLUMN_NAMES = [
  'approved_at',
  'approved_by',
  'contrato_status',
  'contrato_sent_at',
  'contrato_error',
];

const CONTRACT_LINK_COLUMN_NAMES = [
  'contrato_signing_url',
  'contrato_onety_id',
  'onety_funil_id',
  'onety_lead_id',
  'contrato_client_signed_at',
];

const ALL_OPTIONAL_COLUMN_NAMES = [
  ...APPROVAL_COLUMN_NAMES,
  ...CONTRACT_LINK_COLUMN_NAMES,
];

export const isMissingApprovalColumnError = (error) => {
  const msg = String(error?.message || error || '').toLowerCase();
  return ALL_OPTIONAL_COLUMN_NAMES.some(
    (col) => msg.includes(col) && msg.includes('does not exist'),
  );
};

const columnExists = async (adminClient, columnName) => {
  if (isLocalAuthMode() || env.DATABASE_URL || env.SUPABASE_DB_URL) {
    try {
      const { rows } = await query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'empresa_mei_subscription_lines'
           AND column_name = $1
         LIMIT 1`,
        [columnName],
      );
      return Boolean(rows[0]);
    } catch {
      return false;
    }
  }

  try {
    const { error } = await adminClient
      .from('empresa_mei_subscription_lines')
      .select(columnName)
      .limit(1);
    return !error || !isMissingApprovalColumnError(error);
  } catch {
    return false;
  }
};

/**
 * Migration 20260804190000 (approved_at, contrato_status, …).
 * Cache em memória — reinicie o processo após rodar a migration.
 */
export const hasMeiLineApprovalColumns = async (adminClient) => {
  if (approvalColumnsSupported !== null) return approvalColumnsSupported;
  approvalColumnsSupported = await columnExists(adminClient, 'approved_at');
  return approvalColumnsSupported;
};

/**
 * Migration 20260820120000 (contrato_onety_id, contrato_signing_url, …).
 */
export const hasMeiLineContractLinkColumns = async (adminClient) => {
  if (contractLinkColumnsSupported !== null) return contractLinkColumnsSupported;
  contractLinkColumnsSupported = await columnExists(adminClient, 'contrato_onety_id');
  return contractLinkColumnsSupported;
};

const stripKeys = (payload, keys) => {
  const next = { ...payload };
  for (const key of keys) delete next[key];
  return next;
};

/** @param {Record<string, unknown>} payload */
export const stripMeiLineApprovalFields = (payload) =>
  stripKeys(payload, ALL_OPTIONAL_COLUMN_NAMES);

/** @param {Record<string, unknown>} payload */
export const stripMeiLineContractLinkFields = (payload) =>
  stripKeys(payload, CONTRACT_LINK_COLUMN_NAMES);

/**
 * @param {Record<string, unknown>} corePayload
 * @param {Record<string, unknown>} [approvalExtras]
 */
export const buildMeiLineInsertPayload = async (adminClient, corePayload, approvalExtras = {}) => {
  const [approvalSupported, contractSupported] = await Promise.all([
    hasMeiLineApprovalColumns(adminClient),
    hasMeiLineContractLinkColumns(adminClient),
  ]);

  const payload = { ...corePayload };
  for (const [key, value] of Object.entries(approvalExtras)) {
    if (CONTRACT_LINK_COLUMN_NAMES.includes(key) && !contractSupported) continue;
    if (APPROVAL_COLUMN_NAMES.includes(key) && !approvalSupported) continue;
    payload[key] = value;
  }
  return payload;
};

const buildSafePatch = async (adminClient, patch) => {
  const [approvalSupported, contractSupported] = await Promise.all([
    hasMeiLineApprovalColumns(adminClient),
    hasMeiLineContractLinkColumns(adminClient),
  ]);

  let safe = { ...patch };
  if (!approvalSupported) safe = stripKeys(safe, APPROVAL_COLUMN_NAMES);
  if (!contractSupported) safe = stripKeys(safe, CONTRACT_LINK_COLUMN_NAMES);
  return safe;
};

/**
 * @param {import('../config/pgSupabaseCompat.js').createPgServiceClient extends Function ? ReturnType<import('../config/pgSupabaseCompat.js').createPgServiceClient> : any} adminClient
 * @param {Record<string, unknown>} payload
 */
export const insertMeiSubscriptionLine = async (adminClient, payload) => {
  let safePayload = await buildSafePatch(adminClient, payload);
  let { data, error } = await adminClient
    .from('empresa_mei_subscription_lines')
    .insert(safePayload)
    .select()
    .maybeSingle();

  if (!error) return data;
  if (isMissingApprovalColumnError(error)) {
    approvalColumnsSupported = null;
    contractLinkColumnsSupported = null;
    safePayload = stripMeiLineApprovalFields(payload);
    ({ data, error } = await adminClient
      .from('empresa_mei_subscription_lines')
      .insert(safePayload)
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
  let safePatch = await buildSafePatch(adminClient, {
    ...patch,
    updated_at: new Date().toISOString(),
  });

  let { data, error } = await adminClient
    .from('empresa_mei_subscription_lines')
    .update(safePatch)
    .eq('id', lineId)
    .select()
    .maybeSingle();

  if (!error) return data;
  if (isMissingApprovalColumnError(error)) {
    approvalColumnsSupported = null;
    contractLinkColumnsSupported = null;
    safePatch = {
      ...stripMeiLineApprovalFields(patch),
      updated_at: new Date().toISOString(),
    };
    ({ data, error } = await adminClient
      .from('empresa_mei_subscription_lines')
      .update(safePatch)
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
  contractLinkColumnsSupported = null;
};
