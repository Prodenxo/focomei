/** Porte de `frontend/lib/meiAccess.ts` — regra de acesso à área Meu MEI. */
export function canAccessMeiArea(role, mei) {
  if (role === 'superadmin') return true;
  if (role === 'admin' || role === 'usuario') return mei === true;
  return false;
}

/** Porte de `frontend/lib/auth-roles.ts`. */
export function normalizeRoleValue(role) {
  if (!role) return null;
  const normalized = String(role).trim().toLowerCase();
  if (normalized === 'user') return 'usuario';
  if (['superadmin', 'admin', 'usuario', 'outsider'].includes(normalized)) {
    return normalized;
  }
  return null;
}
