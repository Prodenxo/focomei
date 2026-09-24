import { env } from '../config/env.js';
import { createSupabaseClient } from '../config/supabase.js';
import { resolveOpenclawWhatsappPhone } from './openclaw-bot.service.js';
import { calendarDateAddDaysFromIso, calendarDateTodayInSaoPaulo } from './calendar-events.service.js';
import {
  isWhatsappOutboundConfigured,
  sendWhatsappMessage,
} from './whatsapp-outbound.service.js';

const CERTIFICATE_TABLE = 'user_mei_certificates';
const NOTIFICATION_TABLE = 'certificate_expiration_notifications';
const DAYS_BEFORE = 30;

const activeLink = (link, now = Date.now()) => {
  if (link?.status !== true) return false;
  if (!link.expires_at) return true;
  const expiresAt = new Date(link.expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
};

const unique = (values) => [...new Set(values.filter(Boolean))];

const formatDatePtBr = (iso) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(iso || '');
};

const datePart = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  }
  return String(value || '').slice(0, 10);
};

export const isCertificateExpirationWhatsappEnabled = () =>
  String(env.CERTIFICATE_EXPIRATION_WHATSAPP_ENABLED || '').toLowerCase() === 'true';

export const daysBetweenIsoDates = (fromIso, toIso) => {
  const from = Date.parse(`${datePart(fromIso)}T00:00:00.000Z`);
  const to = Date.parse(`${datePart(toIso)}T00:00:00.000Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.round((to - from) / 86_400_000);
};

export const certificateDisplayName = (certificate) => {
  const name = String(
    certificate?.nome_fantasia
    || certificate?.razao_social
    || certificate?.razao_social_titular
    || '',
  ).trim();
  if (name) return name;
  const cnpj = String(certificate?.cert_document || '').replace(/\D/g, '');
  return cnpj.length === 14 ? `CNPJ ${cnpj}` : 'empresa cadastrada';
};

export const formatCertificateExpirationWhatsappMessage = ({
  certificates,
  todayIso,
}) => {
  const items = (certificates || []).map((certificate) => {
    const validTo = datePart(certificate.cert_valid_to);
    const days = daysBetweenIsoDates(todayIso, validTo);
    const when = days === 0
      ? 'vence hoje'
      : days === 1
        ? 'vence amanhã'
        : `vence em ${days} dias`;
    return `• ${certificateDisplayName(certificate)}: ${when}, em ${formatDatePtBr(validTo)}.`;
  });

  return [
    'Olá! Este é um aviso sobre certificado digital:',
    '',
    ...items,
    '',
    'Providencie a renovação para evitar interrupções na emissão de notas e nas consultas.',
  ].join('\n');
};

const loadCertificates = async (db, todayIso) => {
  const endExclusive = calendarDateAddDaysFromIso(todayIso, DAYS_BEFORE + 1);
  const { data, error } = await db
    .from(CERTIFICATE_TABLE)
    .select(
      'id, user_id, empresa_id, cert_document, cert_valid_to, '
      + 'razao_social, nome_fantasia, razao_social_titular',
    )
    .gte('cert_valid_to', `${todayIso}T00:00:00.000Z`)
    .lt('cert_valid_to', `${endExclusive}T00:00:00.000Z`);
  if (error) throw new Error(error.message);
  return data || [];
};

const loadActiveMemberships = async (db, userIds) => {
  if (!userIds.length) return [];
  const { data, error } = await db
    .from('role_x_user_x_empresa')
    .select('user_id, empresas_id, roles_id, status, expires_at')
    .in('user_id', userIds)
    .eq('status', true);
  if (error) throw new Error(error.message);
  return (data || []).filter((link) => activeLink(link));
};

const resolveAdminRoleIds = async (db) => {
  const { data, error } = await db
    .from('roles')
    .select('id, roles');
  if (error) throw new Error(error.message);
  return (data || [])
    .filter((role) => String(role.roles || '').trim().toLowerCase() === 'admin')
    .map((role) => role.id);
};

const loadOfficeAdmins = async (db, companyIds, adminRoleIds) => {
  if (!companyIds.length || !adminRoleIds.length) return [];
  const { data, error } = await db
    .from('role_x_user_x_empresa')
    .select('user_id, empresas_id, roles_id, status, expires_at')
    .in('empresas_id', companyIds)
    .in('roles_id', adminRoleIds)
    .eq('status', true);
  if (error) throw new Error(error.message);
  return (data || []).filter((link) => activeLink(link));
};

const loadWhatsappPhones = async (db, userIds) => {
  if (!userIds.length) return new Map();
  const { data, error } = await db
    .from('n8n_link')
    .select('user_id, user_number')
    .in('user_id', userIds);
  if (error) throw new Error(error.message);
  const phones = new Map();
  for (const row of data || []) {
    const phone = resolveOpenclawWhatsappPhone(row.user_number, row.user_number);
    if (row.user_id && phone) phones.set(row.user_id, phone);
  }
  return phones;
};

const loadSentKeys = async (db, certificateIds) => {
  if (!certificateIds.length) return new Set();
  const { data, error } = await db
    .from(NOTIFICATION_TABLE)
    .select('certificate_id, recipient_user_id, cert_valid_to')
    .in('certificate_id', certificateIds);
  if (error) {
    throw new Error(
      `Não foi possível conferir avisos já enviados. Aplique a migração da tabela ${NOTIFICATION_TABLE}: ${error.message}`,
    );
  }
  return new Set((data || []).map(
    (row) => `${row.certificate_id}:${row.recipient_user_id}:${datePart(row.cert_valid_to)}`,
  ));
};

const notificationKey = (certificate, recipientUserId) =>
  `${certificate.id}:${recipientUserId}:${datePart(certificate.cert_valid_to)}`;

export const groupPendingByRecipient = ({
  certificates,
  memberships,
  adminLinks,
  phones,
  sentKeys,
}) => {
  const companiesByUser = new Map();
  for (const link of memberships) {
    const current = companiesByUser.get(link.user_id) || [];
    current.push(link.empresas_id);
    companiesByUser.set(link.user_id, current);
  }

  const adminsByCompany = new Map();
  for (const link of adminLinks) {
    const current = adminsByCompany.get(link.empresas_id) || [];
    current.push(link.user_id);
    adminsByCompany.set(link.empresas_id, current);
  }

  const grouped = new Map();
  const withoutResponsible = [];
  for (const certificate of certificates) {
    const companyIds = unique([
      certificate.empresa_id,
      ...(companiesByUser.get(certificate.user_id) || []),
    ]);
    const recipientIds = unique(
      companyIds.flatMap((companyId) => adminsByCompany.get(companyId) || []),
    );
    let assigned = false;
    for (const recipientUserId of recipientIds) {
      const phone = phones.get(recipientUserId);
      if (!phone || sentKeys.has(notificationKey(certificate, recipientUserId))) continue;
      const group = grouped.get(recipientUserId) || {
        recipientUserId,
        phone,
        certificates: [],
      };
      group.certificates.push(certificate);
      grouped.set(recipientUserId, group);
      assigned = true;
    }
    if (!assigned && !recipientIds.some(
      (id) => sentKeys.has(notificationKey(certificate, id)),
    )) {
      withoutResponsible.push(certificate.id);
    }
  }
  return { groups: [...grouped.values()], withoutResponsible };
};

const recordSent = async (db, group, channel) => {
  const rows = group.certificates.map((certificate) => ({
    certificate_id: certificate.id,
    recipient_user_id: group.recipientUserId,
    cert_valid_to: certificate.cert_valid_to,
    phone: group.phone,
    channel: channel || null,
    sent_at: new Date().toISOString(),
  }));
  const { error } = await db
    .from(NOTIFICATION_TABLE)
    .upsert(rows, { onConflict: 'certificate_id,recipient_user_id,cert_valid_to' });
  if (error) throw new Error(error.message);
};

export const runCertificateExpirationWhatsappReminders = async (options = {}) => {
  const todayIso = String(options.todayIso || calendarDateTodayInSaoPaulo()).slice(0, 10);
  const startedAt = new Date().toISOString();

  if (!isCertificateExpirationWhatsappEnabled() && options.force !== true) {
    return {
      ok: true,
      skipped: 'disabled',
      todayIso,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }
  if (!isWhatsappOutboundConfigured()) {
    return {
      ok: true,
      skipped: 'whatsapp_not_configured',
      todayIso,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  const db = createSupabaseClient({ useServiceRole: true });
  const certificates = await loadCertificates(db, todayIso);
  if (!certificates.length) {
    return {
      ok: true,
      todayIso,
      totalCertificates: 0,
      sent: 0,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  const memberships = await loadActiveMemberships(
    db,
    unique(certificates.map((certificate) => certificate.user_id)),
  );
  const companyIds = unique([
    ...certificates.map((certificate) => certificate.empresa_id),
    ...memberships.map((link) => link.empresas_id),
  ]);
  const adminRoleIds = await resolveAdminRoleIds(db);
  const adminLinks = await loadOfficeAdmins(db, companyIds, adminRoleIds);
  const phones = await loadWhatsappPhones(
    db,
    unique(adminLinks.map((link) => link.user_id)),
  );
  const sentKeys = await loadSentKeys(
    db,
    unique(certificates.map((certificate) => certificate.id)),
  );
  const { groups, withoutResponsible } = groupPendingByRecipient({
    certificates,
    memberships,
    adminLinks,
    phones,
    sentKeys,
  });

  const results = [];
  for (const group of groups) {
    try {
      const response = await sendWhatsappMessage({
        userId: group.recipientUserId,
        phone: group.phone,
        message: formatCertificateExpirationWhatsappMessage({
          certificates: group.certificates,
          todayIso,
        }),
        source: 'certificate_expiration_reminder',
      });
      await recordSent(db, group, response?.channel);
      results.push({
        recipientUserId: group.recipientUserId,
        status: 'sent',
        certificates: group.certificates.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[certificate-expiration] falha no aviso', {
        recipientUserId: group.recipientUserId,
        message,
      });
      results.push({
        recipientUserId: group.recipientUserId,
        status: 'failed',
        certificates: group.certificates.length,
        message,
      });
    }
  }

  return {
    ok: true,
    todayIso,
    totalCertificates: certificates.length,
    recipients: groups.length,
    sent: results.filter((result) => result.status === 'sent').length,
    failed: results.filter((result) => result.status === 'failed').length,
    withoutResponsible: withoutResponsible.length,
    results,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
};
