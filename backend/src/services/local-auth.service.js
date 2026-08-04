import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { query } from '../config/pg.js';
import { env } from '../config/env.js';
import { badRequest, unauthorized, forbidden } from '../utils/errors.js';
import { assertStrongPassword } from '../utils/passwordPolicy.js';
import {
  buildRecoveryUrl,
  sendPasswordResetEmailViaResend,
} from './password-reset-email.service.js';
import { claimInviteTokenForSignup } from './invite-claim.service.js';

const ROLE_DEFAULT = 'usuario';
const TOKEN_TTL_SEC = 60 * 60 * 24 * 7; // 7 dias

const bufferToBase64Url = (buf) =>
  Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const base64UrlToBuffer = (input) => {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
};

export const isLocalAuthMode = () =>
  String(env.AUTH_MODE || '').trim().toLowerCase() === 'local';

const resolveJwtSecret = () => {
  const secret = String(
    env.AUTH_JWT_SECRET || env.JWT_SECRET || env.SUPABASE_JWT_SECRET || '',
  ).trim();
  if (!secret) {
    throw new Error(
      'AUTH_JWT_SECRET (ou JWT_SECRET) obrigatório com AUTH_MODE=local',
    );
  }
  return secret;
};

/**
 * @param {string} password
 * @returns {string}
 */
export const hashPassword = (password) => {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
};

/**
 * @param {string} password
 * @param {string} stored
 * @returns {boolean}
 */
export const verifyPassword = (password, stored) => {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'base64');
  const expected = Buffer.from(parts[2], 'base64');
  const actual = scryptSync(password, salt, expected.length);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
};

/**
 * @param {Record<string, unknown>} payload
 * @param {number} [expiresInSec]
 */
export const signLocalAccessToken = (payload, expiresInSec = TOKEN_TTL_SEC) => {
  const secret = resolveJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = {
    ...payload,
    iss: 'focomei-local',
    iat: now,
    exp: now + expiresInSec,
  };
  const headerB64 = bufferToBase64Url(JSON.stringify(header));
  const payloadB64 = bufferToBase64Url(JSON.stringify(body));
  const sig = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  return `${headerB64}.${payloadB64}.${bufferToBase64Url(sig)}`;
};

/**
 * @param {string} token
 * @returns {{ id: string, email: string|null, role: string, app_metadata: object, user_metadata: object }|null}
 */
export const verifyLocalAccessToken = (token) => {
  const secret = String(
    env.AUTH_JWT_SECRET || env.JWT_SECRET || env.SUPABASE_JWT_SECRET || '',
  ).trim();
  if (!token || !secret) return null;

  const parts = String(token).split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  let header;
  try {
    header = JSON.parse(base64UrlToBuffer(headerB64).toString('utf8'));
  } catch {
    return null;
  }
  if (header?.alg && header.alg !== 'HS256') return null;

  const expectedSig = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const actualSig = base64UrlToBuffer(signatureB64);
  if (
    expectedSig.length !== actualSig.length
    || !timingSafeEqual(expectedSig, actualSig)
  ) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlToBuffer(payloadB64).toString('utf8'));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) return null;
  if (!payload.sub) return null;
  if (payload.iss && payload.iss !== 'focomei-local') return null;
  // Token de recovery não autentica sessão normal
  if (payload.purpose === 'password_recovery') return null;

  return {
    id: payload.sub,
    email: payload.email || null,
    role: payload.role || 'authenticated',
    app_metadata: payload.app_metadata || {},
    user_metadata: payload.user_metadata || {},
  };
};

const RECOVERY_TTL_SEC = 60 * 60; // 1 hora
const RECOVERY_PURPOSE = 'password_recovery';

/**
 * Decodifica e valida JWT local (inclui purpose). Retorna payload bruto ou null.
 * @param {string} token
 * @returns {Record<string, unknown>|null}
 */
export const verifyLocalJwtPayload = (token) => {
  const secret = String(
    env.AUTH_JWT_SECRET || env.JWT_SECRET || env.SUPABASE_JWT_SECRET || '',
  ).trim();
  if (!token || !secret) return null;

  const parts = String(token).split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  let header;
  try {
    header = JSON.parse(base64UrlToBuffer(headerB64).toString('utf8'));
  } catch {
    return null;
  }
  if (header?.alg && header.alg !== 'HS256') return null;

  const expectedSig = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const actualSig = base64UrlToBuffer(signatureB64);
  if (
    expectedSig.length !== actualSig.length
    || !timingSafeEqual(expectedSig, actualSig)
  ) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlToBuffer(payloadB64).toString('utf8'));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) return null;
  if (!payload.sub) return null;
  if (payload.iss && payload.iss !== 'focomei-local') return null;
  return payload;
};

/**
 * @param {string} tokenHash
 * @returns {{ userId: string, email: string|null }|null}
 */
export const verifyPasswordRecoveryToken = (tokenHash) => {
  const payload = verifyLocalJwtPayload(tokenHash);
  if (!payload || payload.purpose !== RECOVERY_PURPOSE) return null;
  return {
    userId: String(payload.sub),
    email: payload.email ? String(payload.email) : null,
  };
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const buildSession = (userRow, accessToken, expiresIn = TOKEN_TTL_SEC) => {
  const meta = userRow.raw_user_meta_data || {};
  const user = {
    id: userRow.id,
    email: userRow.email,
    phone: userRow.phone || meta.phone || null,
    user_metadata: {
      phone: userRow.phone || meta.phone || null,
      display_name: meta.display_name || null,
      ...meta,
    },
    app_metadata: { provider: 'email', providers: ['email'] },
  };
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: now + expiresIn,
    refresh_token: null,
    user,
  };
};

const getProfileRole = async (userId) => {
  const { rows } = await query(
    'SELECT role FROM public.profiles WHERE id = $1 LIMIT 1',
    [userId],
  );
  return rows[0]?.role || ROLE_DEFAULT;
};

/**
 * Contexto do requester no AUTH_MODE=local (Postgres), sem cliente Supabase.
 * @param {{ id: string }} user
 */
export const resolveLocalRequesterContext = async (user) => {
  if (!user?.id) throw unauthorized();
  await ensureUserNotBlocked(user.id);
  const { role, empresaId, mei } = await getRoleAndCompany(user.id);
  return {
    userId: user.id,
    role: role || ROLE_DEFAULT,
    empresaId: empresaId || null,
    mei: mei === true,
  };
};

const getRoleAndCompany = async (userId) => {
  const profileRole = await getProfileRole(userId);

  // Cargo global (ex.: superadmin) manda sobre o papel na empresa
  if (profileRole === 'superadmin') {
    const { rows: linkRows } = await query(
      `SELECT empresas_id, mei
       FROM public.role_x_user_x_empresa
       WHERE user_id = $1 AND status = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );
    const link = linkRows[0];
    return {
      role: 'superadmin',
      empresaId: link?.empresas_id || null,
      mei: typeof link?.mei === 'boolean' ? link.mei : false,
    };
  }

  const { rows: linkRows } = await query(
    `SELECT empresas_id, roles_id, mei
     FROM public.role_x_user_x_empresa
     WHERE user_id = $1 AND status = true
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  const link = linkRows[0];
  if (!link?.roles_id) {
    return {
      role: profileRole,
      empresaId: null,
      mei: false,
    };
  }

  const { rows: roleRows } = await query(
    'SELECT roles FROM public.roles WHERE id = $1 LIMIT 1',
    [link.roles_id],
  );
  const roleName = String(roleRows[0]?.roles || '')
    .trim()
    .toLowerCase();
  const normalized =
    roleName === 'user' ? 'usuario' : roleName || profileRole || ROLE_DEFAULT;

  return {
    role: normalized,
    empresaId: link.empresas_id || null,
    mei: typeof link.mei === 'boolean' ? link.mei : false,
  };
};

const ensureUserNotBlocked = async (userId) => {
  const { rows } = await query(
    `SELECT id, status, expires_at, empresas_id
     FROM public.role_x_user_x_empresa
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  const link = rows[0];
  if (!link) return;

  if (link.status === false) {
    // Pedido antigo (manual_approval) ou self_serve pendente → libera p/ /planos.
    try {
      const { unlockPendingSelfServeSignup } = await import(
        './self-serve-signup.service.js'
      );
      const unlocked = await unlockPendingSelfServeSignup(userId);
      if (unlocked?.unlocked || unlocked?.reason === 'already_active') {
        return;
      }
    } catch (err) {
      console.warn(
        '[LocalAuth] falha ao liberar vínculo pendente no login:',
        err?.message || err,
      );
    }
    throw forbidden('Seu perfil está bloqueado', { code: 'PROFILE_BLOCKED' });
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    await query(
      'UPDATE public.role_x_user_x_empresa SET status = false WHERE id = $1',
      [link.id],
    );
    throw forbidden('Seu acesso expirou', { code: 'ACCESS_EXPIRED' });
  }
};

const ensureSignupRoleLink = async (userId, empresaId = null) => {
  const { rows: active } = await query(
    `SELECT id FROM public.role_x_user_x_empresa
     WHERE user_id = $1 AND status = true
     LIMIT 1`,
    [userId],
  );
  if (active[0]) return;

  const { rows: roleRows } = await query(
    `SELECT id FROM public.roles
     WHERE lower(roles) IN ('usuario', 'user')
     ORDER BY CASE WHEN lower(roles) = 'usuario' THEN 0 ELSE 1 END
     LIMIT 1`,
  );
  if (!roleRows[0]) {
    console.error('[LocalAuth] role usuario não encontrada em public.roles');
    return;
  }

  await query(
    `INSERT INTO public.role_x_user_x_empresa
      (user_id, roles_id, empresas_id, status, mei)
     VALUES ($1, $2, $3, true, false)`,
    [userId, roleRows[0].id, empresaId],
  );
};

/**
 * Cadastro local (public.users).
 */
export const localSignUp = async ({
  email,
  password,
  phone,
  displayName,
  inviteToken,
}) => {
  if (!email || !password) {
    throw badRequest('Email e senha são obrigatórios');
  }
  assertStrongPassword(password);

  const normalizedEmail = normalizeEmail(email);
  const { rows: existing } = await query(
    'SELECT id FROM public.users WHERE email = $1 AND deleted_at IS NULL LIMIT 1',
    [normalizedEmail],
  );
  if (existing[0]) {
    throw badRequest('Este e-mail já está cadastrado.');
  }

  const meta = {
    display_name: displayName || null,
    phone: phone || null,
  };
  const passwordHash = hashPassword(password);

  let empresaId = null;
  if (inviteToken) {
    empresaId = await claimInviteTokenForSignup(inviteToken);
  }

  const { rows } = await query(
    `INSERT INTO public.users
      (email, password_hash, phone, email_confirmed_at, raw_user_meta_data)
     VALUES ($1, $2, $3, now(), $4::jsonb)
     RETURNING id, email, phone, raw_user_meta_data`,
    [
      normalizedEmail,
      passwordHash,
      phone || null,
      JSON.stringify(meta),
    ],
  );
  const userRow = rows[0];

  // profiles criado pelo trigger; garante role se trigger falhar
  await query(
    `INSERT INTO public.profiles (id, role) VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING`,
    [userRow.id, ROLE_DEFAULT],
  );

  await ensureSignupRoleLink(userRow.id, empresaId);

  const accessToken = signLocalAccessToken({
    sub: userRow.id,
    email: userRow.email,
    role: 'authenticated',
    user_metadata: meta,
    app_metadata: { provider: 'email' },
  });

  const { role, empresaId: empId, mei } = await getRoleAndCompany(userRow.id);
  const session = buildSession(userRow, accessToken);

  return {
    user: session.user,
    userId: userRow.id,
    phone: userRow.phone || null,
    displayName: displayName || null,
    role,
    empresaId: empId,
    mei,
    session,
  };
};

export const localSignIn = async ({ email, password }) => {
  if (!email || !password) {
    throw badRequest('Email e senha são obrigatórios');
  }

  const normalizedEmail = normalizeEmail(email);
  const { rows } = await query(
    `SELECT id, email, phone, password_hash, raw_user_meta_data, banned_until, deleted_at
     FROM public.users
     WHERE email = $1
     LIMIT 1`,
    [normalizedEmail],
  );
  const userRow = rows[0];
  if (!userRow || userRow.deleted_at) {
    throw unauthorized('Email ou senha incorretos');
  }
  if (userRow.banned_until && new Date(userRow.banned_until) > new Date()) {
    throw forbidden('Conta bloqueada');
  }
  if (!verifyPassword(password, userRow.password_hash)) {
    const meta = userRow.raw_user_meta_data || {};
    const needsReset =
      meta.password_reset_required === true
      || meta.password_reset_required === 'true';
    if (needsReset) {
      throw unauthorized(
        'Conta migrada: a senha antiga não vale mais. Use "Esqueci a senha" para definir uma nova.',
      );
    }
    throw unauthorized('Email ou senha incorretos');
  }

  await ensureUserNotBlocked(userRow.id);

  const meta = userRow.raw_user_meta_data || {};
  const accessToken = signLocalAccessToken({
    sub: userRow.id,
    email: userRow.email,
    role: 'authenticated',
    user_metadata: meta,
    app_metadata: { provider: 'email' },
  });

  const { role, empresaId, mei } = await getRoleAndCompany(userRow.id);
  const session = buildSession(userRow, accessToken);

  return {
    user: session.user,
    userId: userRow.id,
    phone: userRow.phone || meta.phone || null,
    displayName: meta.display_name || null,
    role,
    empresaId,
    mei,
    session,
  };
};

export const localGetSession = async (accessToken) => {
  const user = verifyLocalAccessToken(accessToken);
  if (!user) return null;

  await ensureUserNotBlocked(user.id);
  const { role, empresaId, mei } = await getRoleAndCompany(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      phone: user.user_metadata?.phone || null,
      displayName: user.user_metadata?.display_name || null,
    },
    access_token: accessToken,
    role,
    empresaId,
    mei,
  };
};

/**
 * Emite sessão JWT do usuário alvo (AUTH_MODE=local).
 * Superadmin: qualquer alvo. Admin: mesma empresa; não pode impersonar superadmin.
 */
export const localImpersonate = async (accessToken, targetUserId) => {
  if (!accessToken || !targetUserId) {
    throw badRequest('Token e usuário alvo são obrigatórios');
  }

  const requester = verifyLocalAccessToken(accessToken);
  if (!requester?.id) throw unauthorized('Sessão expirada ou inválida');

  await ensureUserNotBlocked(requester.id);
  const {
    role: requesterRole,
    empresaId: requesterEmpresaId,
  } = await getRoleAndCompany(requester.id);

  if (requesterRole !== 'superadmin' && requesterRole !== 'admin') {
    throw forbidden('Apenas administradores podem acessar outras contas');
  }

  if (String(requester.id) === String(targetUserId)) {
    throw badRequest('Você já está nesta conta');
  }

  const { rows } = await query(
    `SELECT id, email, phone, raw_user_meta_data, banned_until, deleted_at
     FROM public.users
     WHERE id = $1
     LIMIT 1`,
    [targetUserId],
  );
  const userRow = rows[0];
  if (!userRow || userRow.deleted_at) {
    throw badRequest('Usuário alvo não encontrado');
  }
  if (userRow.banned_until && new Date(userRow.banned_until) > new Date()) {
    throw forbidden('Conta alvo bloqueada');
  }

  await ensureUserNotBlocked(userRow.id);
  const {
    role: targetRole,
    empresaId: targetEmpresaId,
    mei,
  } = await getRoleAndCompany(userRow.id);

  if (requesterRole === 'admin') {
    if (!requesterEmpresaId || requesterEmpresaId !== targetEmpresaId) {
      throw forbidden('Você só pode acessar usuários da sua própria empresa');
    }
    if (targetRole === 'superadmin') {
      throw forbidden('Administradores não podem acessar contas de Superadmin');
    }
  }

  const meta = userRow.raw_user_meta_data || {};
  const newAccessToken = signLocalAccessToken({
    sub: userRow.id,
    email: userRow.email,
    role: 'authenticated',
    user_metadata: meta,
    app_metadata: { provider: 'email', impersonated_by: requester.id },
  });
  const session = buildSession(userRow, newAccessToken);

  return {
    mode: 'local',
    user: session.user,
    userId: userRow.id,
    phone: userRow.phone || meta.phone || null,
    displayName: meta.display_name || null,
    role: targetRole,
    empresaId: targetEmpresaId,
    mei,
    session,
    // Compatível com clientes que ainda leem token_hash (não usado no modo local).
    email: userRow.email,
    token_hash: null,
  };
};

/**
 * Solicita e-mail de recuperação (AUTH_MODE=local).
 * Sempre resolve com sucesso se Resend ok — não revela se o e-mail existe.
 */
export const localRequestPasswordReset = async (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) throw badRequest('Email é obrigatório');

  const baseUrl = String(env.FRONTEND_URL || '').replace(/\/$/, '');
  if (!baseUrl) {
    throw badRequest('FRONTEND_URL não configurado no backend.');
  }
  const redirectTo = `${baseUrl}/reset-password`;

  const { rows } = await query(
    `SELECT id, email, deleted_at, banned_until
     FROM public.users
     WHERE email = $1
     LIMIT 1`,
    [normalized],
  );
  const userRow = rows[0];

  // Resposta uniforme: só envia se conta ativa existir
  if (
    userRow
    && !userRow.deleted_at
    && !(userRow.banned_until && new Date(userRow.banned_until) > new Date())
  ) {
    const tokenHash = signLocalAccessToken(
      {
        sub: userRow.id,
        email: userRow.email,
        purpose: RECOVERY_PURPOSE,
        role: 'recovery',
      },
      RECOVERY_TTL_SEC,
    );
    const recoveryUrl = buildRecoveryUrl(redirectTo, tokenHash);
    await sendPasswordResetEmailViaResend({ to: normalized, recoveryUrl });
  }

  return { success: true };
};

/**
 * Confirma nova senha com JWT de recovery (público).
 */
export const localConfirmPasswordReset = async ({ tokenHash, newPassword }) => {
  if (!tokenHash) throw badRequest('Token de recuperação ausente');
  if (!newPassword) throw badRequest('Senha inválida');
  assertStrongPassword(newPassword);

  const recovered = verifyPasswordRecoveryToken(tokenHash);
  if (!recovered?.userId) {
    throw badRequest('Link de recuperação inválido ou expirado. Solicite um novo.');
  }

  const { rows } = await query(
    `SELECT id, raw_user_meta_data, deleted_at, banned_until
     FROM public.users
     WHERE id = $1
     LIMIT 1`,
    [recovered.userId],
  );
  const userRow = rows[0];
  if (!userRow || userRow.deleted_at) {
    throw badRequest('Link de recuperação inválido ou expirado. Solicite um novo.');
  }
  if (userRow.banned_until && new Date(userRow.banned_until) > new Date()) {
    throw forbidden('Conta bloqueada');
  }

  const passwordHash = hashPassword(newPassword);
  const meta = { ...(userRow.raw_user_meta_data || {}) };
  delete meta.password_reset_required;

  await query(
    `UPDATE public.users
     SET password_hash = $1,
         raw_user_meta_data = $2::jsonb,
         updated_at = now()
     WHERE id = $3`,
    [passwordHash, JSON.stringify(meta), recovered.userId],
  );

  return { success: true };
};

/**
 * Atualiza senha com sessão local autenticada.
 */
export const localUpdatePassword = async ({ userId, newPassword }) => {
  if (!userId) throw unauthorized('Token ausente');
  if (!newPassword) throw badRequest('Senha inválida');
  assertStrongPassword(newPassword);

  const { rows } = await query(
    `SELECT id, raw_user_meta_data, deleted_at
     FROM public.users
     WHERE id = $1
     LIMIT 1`,
    [userId],
  );
  const userRow = rows[0];
  if (!userRow || userRow.deleted_at) throw unauthorized();

  const passwordHash = hashPassword(newPassword);
  const meta = { ...(userRow.raw_user_meta_data || {}) };
  delete meta.password_reset_required;

  await query(
    `UPDATE public.users
     SET password_hash = $1,
         raw_user_meta_data = $2::jsonb,
         updated_at = now()
     WHERE id = $3`,
    [passwordHash, JSON.stringify(meta), userId],
  );

  return { success: true };
};

export const localSignOut = async () => {
  // JWT stateless — cliente descarta o token
};
