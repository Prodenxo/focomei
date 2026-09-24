import { normalizeRoleValue } from '@/lib/meiAccess';

/**
 * O login continua no app Expo. No web o AsyncStorage grava direto no
 * `localStorage` com a mesma chave, então lemos a sessão já existente.
 */
export const LOCAL_AUTH_STORAGE_KEY = 'focomei-local-auth';
export const SUPABASE_AUTH_STORAGE_KEY = 'financas-pessoais-auth';

function readJson(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readLocalSession() {
  const snapshot = readJson(LOCAL_AUTH_STORAGE_KEY);
  if (!snapshot?.accessToken || !snapshot?.user?.id) return null;

  return {
    origem: 'local',
    accessToken: snapshot.accessToken,
    userId: String(snapshot.user.id),
    email: snapshot.user.email || null,
    displayName:
      snapshot.displayName || snapshot.user.user_metadata?.display_name || null,
    role: normalizeRoleValue(snapshot.role),
    mei: typeof snapshot.mei === 'boolean' ? snapshot.mei : null,
    empresaId: snapshot.empresaId || null,
  };
}

function readSupabaseSession() {
  const stored = readJson(SUPABASE_AUTH_STORAGE_KEY);
  const session = stored?.currentSession || stored?.session || stored;
  const accessToken = session?.access_token;
  const user = session?.user;
  if (!accessToken || !user?.id) return null;

  const expiresAt = Number(session.expires_at || 0);
  if (expiresAt && expiresAt * 1000 <= Date.now()) return null;

  return {
    origem: 'supabase',
    accessToken,
    userId: String(user.id),
    email: user.email || null,
    displayName: user.user_metadata?.display_name || null,
    /** Role e MEI vivem no vínculo consultado pelo app antigo; aqui só o que a sessão traz. */
    role: null,
    mei: null,
    empresaId: null,
  };
}

export function readSession() {
  return readLocalSession() || readSupabaseSession();
}

export function readAccessToken() {
  return readSession()?.accessToken || null;
}

/** Primeiro nome, para a saudação do cabeçalho. */
export function firstName(session) {
  const nome = String(session?.displayName || '').trim();
  if (nome) return nome.split(/\s+/)[0];
  const email = String(session?.email || '').trim();
  if (email) return email.split('@')[0];
  return 'MEI';
}
