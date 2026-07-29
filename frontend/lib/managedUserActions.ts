import type { ManagedUser } from './user-management';

export type ManagedUserActionFlags = {
  canEdit: boolean;
  canImpersonate: boolean;
  canDelete: boolean;
  canBan: boolean;
};

/** Regras de ações na lista Gerenciar acessos (inclui editar a própria conta). */
export function getManagedUserActions(
  actorRole: string | null,
  target: ManagedUser,
  actorUserId?: string | null
): ManagedUserActionFlags {
  if (!actorRole || !target?.id) {
    return { canEdit: false, canImpersonate: false, canDelete: false, canBan: false };
  }

  const isSelf = Boolean(actorUserId) && String(target.id) === String(actorUserId);

  if (actorRole === 'superadmin') {
    return {
      canEdit: true,
      canImpersonate: !isSelf,
      canDelete: !isSelf,
      canBan: !isSelf,
    };
  }

  if (actorRole === 'admin') {
    const canManageUsuario = target.role === 'usuario';
    return {
      canEdit: isSelf || canManageUsuario,
      canImpersonate: !isSelf && canManageUsuario,
      canDelete: !isSelf && canManageUsuario,
      canBan: !isSelf && canManageUsuario,
    };
  }

  return { canEdit: false, canImpersonate: false, canDelete: false, canBan: false };
}

/** Admin vê o toggle MEI se o módulo estiver ativo na empresa ou se já houver MEI na conta (para poder desligar). */
export function shouldShowAdminMeiToggle(
  empresas: Array<{ max_mei?: number | null }>,
  options: { meiActive: boolean; userHasMei?: boolean | null }
): boolean {
  const moduleActive = empresas.some((e) => (e.max_mei ?? 0) > 0);
  return moduleActive || options.meiActive || options.userHasMei === true;
}
