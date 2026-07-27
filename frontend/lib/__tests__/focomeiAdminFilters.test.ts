import {
  countFocoMeiEmpresaAdmins,
  filterFocoMeiAdminEmpresas,
  filterFocoMeiAdminUsers,
} from '../focomeiAdminFilters'
import type { ManagedUser } from '../user-management'
import type { EmpresaOption } from '../../services/empresaService'

function user (partial: Partial<ManagedUser> & Pick<ManagedUser, 'id' | 'role'>): ManagedUser {
  return {
    email: null,
    displayName: null,
    phone: null,
    empresaId: null,
    empresaName: null,
    status: true,
    mei: false,
    expiresAt: null,
    productLine: null,
    ...partial,
  }
}

describe('empresas MEI disponível ou em uso', () => {
  const empresas: EmpresaOption[] = [
    { id: 'e-disp', empresa: 'Com vagas', max_mei: 3 },
    { id: 'e-uso', empresa: 'Só em uso', max_mei: 0 },
    { id: 'e-nada', empresa: 'Sem MEI', max_mei: 0 },
  ]

  it('inclui max_mei > 0 e empresa com membro mei=true', () => {
    const users = [
      user({ id: 'm1', role: 'usuario', empresaId: 'e-uso', mei: true }),
    ]
    const ids = filterFocoMeiAdminEmpresas(empresas, users).map((e) => e.id)
    expect(ids).toEqual(['e-disp', 'e-uso'])
  })
})

describe('countFocoMeiEmpresaAdmins', () => {
  const empresas = [{ id: 'e1' }, { id: 'e2' }]

  it('conta todos os admins da empresa, com ou sem vaga MEI', () => {
    const users = [
      user({ id: 'a1', role: 'admin', empresaId: 'e1', mei: false }),
      user({ id: 'a2', role: 'admin', empresaId: 'e1', mei: true }),
      user({ id: 'm1', role: 'usuario', empresaId: 'e1', mei: true }),
    ]
    expect(countFocoMeiEmpresaAdmins(users, empresas)).toBe(2)
  })

  it('não conta admin de empresa fora do conjunto MEI', () => {
    const users = [
      user({ id: 'a1', role: 'admin', empresaId: 'e-other', mei: false }),
    ]
    expect(countFocoMeiEmpresaAdmins(users, empresas)).toBe(0)
  })

  it('não conta cliente MEI com nome Admin e role usuario', () => {
    const users = [
      user({
        id: 'm1',
        role: 'usuario',
        empresaId: 'e1',
        mei: true,
        displayName: 'Admin FortCim',
      }),
    ]
    expect(countFocoMeiEmpresaAdmins(users, empresas)).toBe(0)
  })
})

describe('filterFocoMeiAdminUsers', () => {
  it('aba Usuários continua só com vaga MEI', () => {
    const users = [
      user({ id: 'a1', role: 'admin', empresaId: 'e1', mei: false }),
      user({ id: 'm1', role: 'usuario', empresaId: 'e1', mei: true }),
    ]
    expect(filterFocoMeiAdminUsers(users).map((u) => u.id)).toEqual(['m1'])
  })
})
