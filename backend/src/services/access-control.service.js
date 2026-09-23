import { createSupabaseClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { query } from '../config/pg.js';
import { forbidden, serviceUnavailable } from '../utils/errors.js';

export const ACCESS_STATUS_ACTIVE = 'active';
export const ACCESS_STATUS_BLOCKED = 'blocked';
export const OFFICE_BLOCKED_CODE = 'OFFICE_BLOCKED';
export const PROFILE_BLOCKED_CODE = 'PROFILE_BLOCKED';
export const OFFICE_CONTEXT_FORBIDDEN_CODE = 'OFFICE_CONTEXT_FORBIDDEN';
export const OFFICE_BLOCKED_MESSAGE =
  'O acesso a este escritório está suspenso. Entre em contato com o responsável.';

const isLocalMode = () => String(env.AUTH_MODE || '').trim().toLowerCase() === 'local';

const normalizeRole = (value) => {
  const role = String(value || '').trim().toLowerCase();
  return role === 'user' ? 'usuario' : role || null;
};

const normalizeMembership = (row) => ({
  id: row?.id || null,
  empresaId: row?.empresas_id || row?.empresaId || null,
  empresaName:
    row?.empresa_name
    || row?.empresaName
    || row?.empresa?.nome_fantasia
    || row?.empresa?.empresa
    || null,
  officeStatus:
    row?.office_status
    || row?.officeStatus
    || row?.empresa?.access_status
    || ACCESS_STATUS_ACTIVE,
  role: normalizeRole(row?.role_name || row?.role || row?.roles?.roles),
  status: row?.status !== false,
  expiresAt: row?.expires_at || row?.expiresAt || null,
  createdAt: row?.created_at || row?.createdAt || null,
});

const isExpired = (membership, now) => {
  if (!membership?.expiresAt) return false;
  const expiresAt = new Date(membership.expiresAt);
  return Number.isFinite(expiresAt.getTime()) && expiresAt <= now;
};

const isMembershipActive = (membership, now) =>
  membership?.status !== false && !isExpired(membership, now);

const isOfficeBlocked = (membership) =>
  Boolean(
    membership?.empresaId
    && membership?.officeStatus === ACCESS_STATUS_BLOCKED,
  );

export const evaluateAccessSnapshot = (
  snapshot,
  { selectedEmpresaId = null, allowBlockedOfficeManagement = false, now = new Date() } = {},
) => {
  const memberships = (snapshot?.memberships || []).map(normalizeMembership);
  const profileRole = normalizeRole(snapshot?.profileRole);
  const activeMemberships = memberships.filter((row) => isMembershipActive(row, now));
  const superadmin = profileRole === 'superadmin'
    || activeMemberships.some((row) => row.role === 'superadmin');

  if (memberships.length > 0 && activeMemberships.length === 0) {
    return {
      allowed: false,
      code: PROFILE_BLOCKED_CODE,
      message: 'Seu perfil está bloqueado',
      superadmin,
      memberships,
    };
  }

  if (selectedEmpresaId) {
    const selected = activeMemberships.find(
      (row) => String(row.empresaId || '') === String(selectedEmpresaId),
    );
    if (!selected) {
      return {
        allowed: false,
        code: OFFICE_CONTEXT_FORBIDDEN_CODE,
        message: 'Você não possui acesso ativo a este escritório.',
        superadmin,
        memberships,
      };
    }
    if (isOfficeBlocked(selected) && !(superadmin && allowBlockedOfficeManagement)) {
      return {
        allowed: false,
        code: OFFICE_BLOCKED_CODE,
        message: OFFICE_BLOCKED_MESSAGE,
        superadmin,
        empresaId: selected.empresaId,
        memberships,
      };
    }
    return {
      allowed: true,
      superadmin,
      empresaId: selected.empresaId,
      role: selected.role || profileRole,
      memberships,
    };
  }

  const available = activeMemberships.find((row) => !isOfficeBlocked(row));
  if (available) {
    return {
      allowed: true,
      superadmin,
      empresaId: available.empresaId,
      role: available.role || profileRole,
      memberships,
    };
  }

  if (activeMemberships.length > 0) {
    if (superadmin && allowBlockedOfficeManagement) {
      return {
        allowed: true,
        superadmin,
        empresaId: activeMemberships[0]?.empresaId || null,
        role: activeMemberships[0]?.role || profileRole,
        memberships,
      };
    }
    return {
      allowed: false,
      code: OFFICE_BLOCKED_CODE,
      message: OFFICE_BLOCKED_MESSAGE,
      superadmin,
      empresaId: activeMemberships[0]?.empresaId || null,
      memberships,
    };
  }

  return {
    allowed: true,
    superadmin,
    empresaId: null,
    role: profileRole,
    memberships,
  };
};

const loadAccessSnapshotPg = async (userId) => {
  const [{ rows: memberships }, { rows: profiles }] = await Promise.all([
    query(
      `SELECT
         rx.id,
         rx.empresas_id,
         rx.status,
         rx.expires_at,
         rx.created_at,
         r.roles AS role_name,
         e.access_status AS office_status,
         COALESCE(e.nome_fantasia, e.empresa) AS empresa_name
       FROM public.role_x_user_x_empresa rx
       LEFT JOIN public.roles r ON r.id = rx.roles_id
       LEFT JOIN public.empresas e ON e.id = rx.empresas_id
       WHERE rx.user_id = $1
       ORDER BY rx.created_at DESC`,
      [userId],
    ),
    query('SELECT role FROM public.profiles WHERE id = $1 LIMIT 1', [userId]),
  ]);
  return {
    profileRole: profiles[0]?.role || null,
    memberships: memberships || [],
  };
};

const loadAccessSnapshotSupabase = async (userId) => {
  const client = createSupabaseClient({ useServiceRole: true });
  const [{ data: links, error: linksError }, { data: profile, error: profileError }] =
    await Promise.all([
      client
        .from('role_x_user_x_empresa')
        .select('id, empresas_id, roles_id, status, expires_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      client.from('profiles').select('role').eq('id', userId).maybeSingle(),
    ]);
  if (linksError) throw linksError;
  if (profileError) throw profileError;

  const roleIds = [...new Set((links || []).map((row) => row.roles_id).filter(Boolean))];
  const empresaIds = [...new Set((links || []).map((row) => row.empresas_id).filter(Boolean))];
  const [{ data: roles, error: rolesError }, { data: empresas, error: empresasError }] =
    await Promise.all([
      roleIds.length
        ? client.from('roles').select('id, roles').in('id', roleIds)
        : Promise.resolve({ data: [], error: null }),
      empresaIds.length
        ? client
            .from('empresas')
            .select('id, empresa, nome_fantasia, access_status')
            .in('id', empresaIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (rolesError) throw rolesError;
  if (empresasError) throw empresasError;

  const roleById = new Map((roles || []).map((row) => [row.id, row.roles]));
  const empresaById = new Map((empresas || []).map((row) => [row.id, row]));
  return {
    profileRole: profile?.role || null,
    memberships: (links || []).map((row) => ({
      ...row,
      role_name: roleById.get(row.roles_id) || null,
      office_status: empresaById.get(row.empresas_id)?.access_status || ACCESS_STATUS_ACTIVE,
      empresa_name:
        empresaById.get(row.empresas_id)?.nome_fantasia
        || empresaById.get(row.empresas_id)?.empresa
        || null,
    })),
  };
};

export const loadAccessSnapshot = async (userId) => {
  if (!userId) return { profileRole: null, memberships: [] };
  try {
    return isLocalMode()
      ? await loadAccessSnapshotPg(userId)
      : await loadAccessSnapshotSupabase(userId);
  } catch (error) {
    console.error('[AccessControl] Falha ao validar acesso:', error?.message || error);
    throw serviceUnavailable(
      'Não foi possível validar o acesso ao escritório. Tente novamente.',
      { code: 'ACCESS_VALIDATION_UNAVAILABLE' },
    );
  }
};

export const assertUserOperationalAccess = async (
  userId,
  { selectedEmpresaId = null, allowBlockedOfficeManagement = false } = {},
) => {
  const snapshot = await loadAccessSnapshot(userId);
  const decision = evaluateAccessSnapshot(snapshot, {
    selectedEmpresaId,
    allowBlockedOfficeManagement,
  });
  if (!decision.allowed) {
    throw forbidden(decision.message, {
      code: decision.code,
      empresaId: decision.empresaId || null,
      availableEmpresas: decision.memberships
        .filter((row) => isMembershipActive(row, new Date()) && !isOfficeBlocked(row))
        .map((row) => ({
          id: row.empresaId,
          nome: row.empresaName,
        }))
        .filter((row) => row.id),
    });
  }
  return decision;
};
