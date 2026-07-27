import { isMeiSlotUser } from './meiUserSlot'
import type { ManagedUser } from './user-management'
import type { EmpresaOption } from '../services/empresaService'

/** MEI disponível = limite de vagas (max_mei) > 0. */
export function isEmpresaMeiDisponivel (
  empresa: Pick<EmpresaOption, 'max_mei'>,
): boolean {
  const limite =
    empresa.max_mei === null || empresa.max_mei === undefined
      ? 0
      : Number(empresa.max_mei) || 0
  return limite > 0
}

/** @deprecated use isEmpresaMeiDisponivel */
export const isEmpresaMeiModuleActive = isEmpresaMeiDisponivel

/** Empresas com MEI disponível (max_mei) ou MEI em uso (algum membro mei=true). */
export function filterFocoMeiAdminEmpresas (
  empresas: EmpresaOption[],
  users: ManagedUser[] = [],
): EmpresaOption[] {
  const meiEmUso = new Set(
    users
      .filter((u) => isMeiSlotUser(u.mei) && u.empresaId)
      .map((u) => u.empresaId as string),
  )
  return empresas.filter(
    (empresa) => isEmpresaMeiDisponivel(empresa) || meiEmUso.has(empresa.id),
  )
}

/** Lista da aba Usuários: só quem tem vaga MEI liberada. */
export function filterFocoMeiAdminUsers (users: ManagedUser[]): ManagedUser[] {
  return users.filter((user) => isMeiSlotUser(user.mei))
}

/**
 * Todos os Admins/Superadmins das empresas com MEI disponível ou em uso.
 * Independente de o admin ocupar vaga MEI (contato do escritório costuma não ocupar).
 */
export function countFocoMeiEmpresaAdmins (
  users: ManagedUser[],
  focomeiEmpresas: Pick<EmpresaOption, 'id'>[],
): number {
  const empIds = new Set(focomeiEmpresas.map((e) => e.id))
  return users.filter((user) => {
    if (!user.empresaId || !empIds.has(user.empresaId)) return false
    if (user.status === false) return false
    return user.role === 'admin' || user.role === 'superadmin'
  }).length
}

/** Membros de uma empresa MEI — inclui PF/Outros para o admin liberar vaga. */
export function listEmpresaMembersForMeiAdmin (
  users: ManagedUser[],
  empresaId: string,
  role?: string | null,
): ManagedUser[] {
  return users.filter((user) => {
    if (user.empresaId !== empresaId) return false
    if (role === 'admin') {
      return user.role !== 'superadmin' && user.role !== 'outsider'
    }
    return true
  })
}
