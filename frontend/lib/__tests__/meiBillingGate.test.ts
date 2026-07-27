import { shouldRequireMeiBillingRoute } from '../meiBillingGate'

const mockFetchMeiBillingStatus = jest.fn()
const mockGetState = jest.fn()

jest.mock('@/services/billingService', () => ({
  fetchMeiBillingStatus: (...args: unknown[]) => mockFetchMeiBillingStatus(...args),
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: {
    getState: () => mockGetState(),
  },
}))

describe('shouldRequireMeiBillingRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('superadmin nunca precisa de /planos', async () => {
    mockGetState.mockReturnValue({ role: 'superadmin', mei: false })
    await expect(shouldRequireMeiBillingRoute()).resolves.toBe(false)
    expect(mockFetchMeiBillingStatus).not.toHaveBeenCalled()
  })

  it('usuario comum nunca precisa de /planos', async () => {
    mockGetState.mockReturnValue({ role: 'usuario', mei: false })
    await expect(shouldRequireMeiBillingRoute()).resolves.toBe(false)
  })

  it('admin com empresa já liberada (required=false) não vai a /planos mesmo com mei=false', async () => {
    mockGetState.mockReturnValue({ role: 'admin', mei: false })
    mockFetchMeiBillingStatus.mockResolvedValue({
      required: false,
      maxMei: 5,
      hasActiveSubscription: true,
    })
    await expect(shouldRequireMeiBillingRoute()).resolves.toBe(false)
  })

  it('admin sem plano (required=true) precisa de /planos', async () => {
    mockGetState.mockReturnValue({ role: 'admin', mei: false })
    mockFetchMeiBillingStatus.mockResolvedValue({
      required: true,
      maxMei: 0,
      hasActiveSubscription: false,
    })
    await expect(shouldRequireMeiBillingRoute()).resolves.toBe(true)
  })

  it('falha da API: admin com mei=true não força /planos', async () => {
    mockGetState.mockReturnValue({ role: 'admin', mei: true })
    mockFetchMeiBillingStatus.mockRejectedValue(new Error('network'))
    await expect(shouldRequireMeiBillingRoute()).resolves.toBe(false)
  })

  it('falha da API: admin com mei=false força /planos', async () => {
    mockGetState.mockReturnValue({ role: 'admin', mei: false })
    mockFetchMeiBillingStatus.mockRejectedValue(new Error('network'))
    await expect(shouldRequireMeiBillingRoute()).resolves.toBe(true)
  })
})
