import { getManagedUserActions } from '../managedUserActions'
import type { ManagedUser } from '../user-management'

const user = (partial: Partial<ManagedUser> & Pick<ManagedUser, 'id' | 'role'>): ManagedUser => ({
  email: 'a@b.com',
  status: true,
  mei: true,
  ...partial,
})

describe('getManagedUserActions', () => {
  it('superadmin edita a si e outros superadmins', () => {
    const self = getManagedUserActions('superadmin', user({ id: '1', role: 'superadmin' }), '1')
    expect(self.canEdit).toBe(true)
    expect(self.canDelete).toBe(false)
    expect(self.canImpersonate).toBe(false)

    const otherSa = getManagedUserActions('superadmin', user({ id: '2', role: 'superadmin' }), '1')
    expect(otherSa.canEdit).toBe(true)
    expect(otherSa.canImpersonate).toBe(true)
    expect(otherSa.canDelete).toBe(true)
  })

  it('superadmin edita usuario', () => {
    const flags = getManagedUserActions('superadmin', user({ id: '9', role: 'usuario' }), '1')
    expect(flags.canEdit).toBe(true)
  })

  it('admin edita a si e usuarios, nao outros admins', () => {
    const self = getManagedUserActions('admin', user({ id: '1', role: 'admin' }), '1')
    expect(self.canEdit).toBe(true)

    const otherAdmin = getManagedUserActions('admin', user({ id: '2', role: 'admin' }), '1')
    expect(otherAdmin.canEdit).toBe(false)

    const usuario = getManagedUserActions('admin', user({ id: '3', role: 'usuario' }), '1')
    expect(usuario.canEdit).toBe(true)
  })
})
