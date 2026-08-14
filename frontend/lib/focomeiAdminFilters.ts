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

/** Empresa criada mas ainda sem plano MEI pago (presa em /planos). */
export function isEmpresaAguardandoPlano (
  empresa: Pick<EmpresaOption, 'max_mei'>,
): boolean {
  return !isEmpresaMeiDisponivel(empresa)
}

/**
 * Self-serve / checkout: empresa sem max_mei mas com admin ativo vinculado.
 * Exclui empresas já visíveis na lista MEI (em uso com mei=true).
 */
export function filterFocoMeiAdminEmpresasAguardandoPlano (
  empresas: EmpresaOption[],
  users: ManagedUser[] = [],
): EmpresaOption[] {
  const meiEmUso = new Set(
    users
      .filter((u) => isMeiSlotUser(u.mei) && u.empresaId)
      .map((u) => u.empresaId as string),
  )

  return empresas.filter((empresa) => {
    if (!isEmpresaAguardandoPlano(empresa)) return false
    if (meiEmUso.has(empresa.id)) return false
    const hasAdmin = users.some(
      (u) =>
        u.empresaId === empresa.id
        && u.status !== false
        && (u.role === 'admin' || u.role === 'superadmin'),
    )
    return hasAdmin
  })
}

/** @deprecated use isEmpresaMeiDisponivel */
export const isEmpresaMeiModuleActive = isEmpresaMeiDisponivel

/** Empresa com módulo MEI desligado (max_mei = 0), excluindo as que aguardam plano. */
export function filterFocoMeiAdminEmpresasMeiDesativado (
  empresas: EmpresaOption[],
  users: ManagedUser[] = [],
): EmpresaOption[] {
  const aguardandoIds = new Set(
    filterFocoMeiAdminEmpresasAguardandoPlano(empresas, users).map((e) => e.id),
  )
  return empresas.filter(
    (empresa) => !isEmpresaMeiDisponivel(empresa) && !aguardandoIds.has(empresa.id),
  )
}

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

/**
 * Aba Usuários: todos os vínculos das empresas MEI (disponível ou em uso),
 * com ou sem vaga MEI liberada.
 */
export function filterFocoMeiAdminUsers (
  users: ManagedUser[],
  focomeiEmpresas: Pick<EmpresaOption, 'id'>[] = [],
): ManagedUser[] {
  const empIds = new Set(focomeiEmpresas.map((e) => e.id))
  if (empIds.size === 0) return []
  return users.filter((user) => Boolean(user.empresaId && empIds.has(user.empresaId)))
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

/** Quantos vínculos têm vaga MEI liberada (métrica, não filtro da lista). */
export function countFocoMeiSlotUsers (
  users: ManagedUser[],
  focomeiEmpresas: Pick<EmpresaOption, 'id'>[],
): number {
  const empIds = new Set(focomeiEmpresas.map((e) => e.id))
  return users.filter(
    (user) =>
      user.empresaId
      && empIds.has(user.empresaId)
      && isMeiSlotUser(user.mei),
  ).length
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
