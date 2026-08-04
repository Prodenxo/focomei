import crypto from 'crypto';
import { createSupabaseClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { query } from '../config/pg.js';
import { badRequest } from '../utils/errors.js';

const INVITE_TOKEN_MIN_LENGTH = 10;

export const hashInviteToken = (rawToken) => (
  crypto.createHash('sha256').update(String(rawToken).trim(), 'utf8').digest('hex')
);

const assertInviteRowPending = (invite) => {
  if (!invite?.id) return false;
  if (invite.revoked_at) return false;
  if (!invite.is_reusable && invite.used_at) return false;
  if (new Date(invite.expires_at) <= new Date()) return false;
  return true;
};

/**
 * Consome convite no cadastro (signup) e devolve empresas_id.
 * One-shot: marca used_at; reutilizável: incrementa uses_count.
 */
export const claimInviteTokenForSignup = async (rawToken) => {
  if (
    rawToken == null
    || typeof rawToken !== 'string'
    || rawToken.trim().length < INVITE_TOKEN_MIN_LENGTH
  ) {
    throw badRequest('Convite inválido');
  }

  const tokenHash = hashInviteToken(rawToken);
  const isLocal = String(env.AUTH_MODE || '').trim().toLowerCase() === 'local';

  if (isLocal) {
    const { rows } = await query(
      `SELECT id, empresas_id, expires_at, used_at, revoked_at, is_reusable, uses_count
       FROM public.empresa_invites
       WHERE token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );
    const invite = rows[0];
    if (!assertInviteRowPending(invite)) {
      throw badRequest('Convite inválido, expirado ou já utilizado');
    }

    if (invite.is_reusable) {
      await query(
        `UPDATE public.empresa_invites
         SET uses_count = COALESCE(uses_count, 0) + 1
         WHERE id = $1`,
        [invite.id],
      );
    } else {
      const { rowCount } = await query(
        `UPDATE public.empresa_invites
         SET used_at = now(), uses_count = 1
         WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL`,
        [invite.id],
      );
      if (!rowCount) {
        throw badRequest('Convite indisponível ou já utilizado');
      }
    }

    return String(invite.empresas_id);
  }

  const admin = createSupabaseClient({ useServiceRole: true });
  const { data: invite, error } = await admin
    .from('empresa_invites')
    .select('id, empresas_id, expires_at, used_at, revoked_at, is_reusable, uses_count')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) throw badRequest(error.message);
  if (!assertInviteRowPending(invite)) {
    throw badRequest('Convite inválido, expirado ou já utilizado');
  }

  if (invite.is_reusable) {
    await admin
      .from('empresa_invites')
      .update({ uses_count: (invite.uses_count || 0) + 1 })
      .eq('id', invite.id);
  } else {
    const { data: claimed, error: claimErr } = await admin
      .from('empresa_invites')
      .update({ used_at: new Date().toISOString(), uses_count: 1 })
      .eq('id', invite.id)
      .is('used_at', null)
      .is('revoked_at', null)
      .select('id')
      .maybeSingle();
    if (claimErr) throw badRequest(claimErr.message);
    if (!claimed?.id) throw badRequest('Convite indisponível ou já utilizado');
  }

  return String(invite.empresas_id);
};
