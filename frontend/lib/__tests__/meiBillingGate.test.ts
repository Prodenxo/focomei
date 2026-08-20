import { resolveMeiBillingHref, shouldRequireMeiBillingRoute } from '../meiBillingGate'

const mockFetchMeiBillingStatus = jest.fn()
const mockGetState = jest.fn()
const mockReadMeiContractPendingSession = jest.fn()
const mockClearMeiContractPendingSession = jest.fn()

jest.mock('@/services/billingService', () => ({
  fetchMeiBillingStatus: (...args: unknown[]) => mockFetchMeiBillingStatus(...args),
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: {
    getState: () => mockGetState(),
  },
}))

jest.mock('../meiContractPendingSession', () => ({
  hasMeiContractPendingSession: (data: { lineId?: string; contratoOnetyId?: number | null } | null) =>
    Boolean(data?.lineId || data?.contratoOnetyId),
  readMeiContractPendingSession: (...args: unknown[]) =>
    mockReadMeiContractPendingSession(...args),
  clearMeiContractPendingSession: (...args: unknown[]) =>
    mockClearMeiContractPendingSession(...args),
  stashMeiContractPendingSession: jest.fn(),
}))

describe('shouldRequireMeiBillingRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReadMeiContractPendingSession.mockResolvedValue(null)
    mockClearMeiContractPendingSession.mockResolvedValue(undefined)
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

  it('admin aguardando contrato vai para aguardando-contrato', async () => {
    mockGetState.mockReturnValue({ role: 'admin', mei: false })
    mockFetchMeiBillingStatus.mockResolvedValue({
      required: true,
      phase: 'aguardando_contrato',
      maxMei: 0,
      hasActiveSubscription: false,
      contract: { contratoOnetyId: 9413 },
    })
    await expect(shouldRequireMeiBillingRoute()).resolves.toBe(true)
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

  it('resolveMeiBillingHref retorna aguardando-contrato quando phase aguardando', async () => {
    mockGetState.mockReturnValue({ role: 'admin', mei: false })
    mockFetchMeiBillingStatus.mockResolvedValue({
      required: true,
      phase: 'aguardando_contrato',
      maxMei: 0,
      hasActiveSubscription: false,
    })
    await expect(resolveMeiBillingHref()).resolves.toBe('/(app)/aguardando-contrato')
  })

  it('resolveMeiBillingHref infere aguardando pelo contrato pendente', async () => {
    mockGetState.mockReturnValue({ role: 'admin', mei: false })
    mockFetchMeiBillingStatus.mockResolvedValue({
      required: true,
      maxMei: 0,
      hasActiveSubscription: false,
      contract: { lineId: 'abc', contratoOnetyId: 99 },
    })
    await expect(resolveMeiBillingHref()).resolves.toBe('/(app)/aguardando-contrato')
  })

  it('resolveMeiBillingHref infere aguardando pela sessão local', async () => {
    mockGetState.mockReturnValue({ role: 'admin', mei: false })
    mockFetchMeiBillingStatus.mockResolvedValue({
      required: true,
      phase: 'planos',
      maxMei: 0,
      hasActiveSubscription: false,
    })
    mockReadMeiContractPendingSession.mockResolvedValue({
      lineId: 'local-line',
      contratoOnetyId: 123,
      savedAt: new Date().toISOString(),
    })

    await expect(resolveMeiBillingHref()).resolves.toBe('/(app)/aguardando-contrato')
  })

  it('resolveMeiBillingHref retorna planos quando ainda sem contrato', async () => {
    mockGetState.mockReturnValue({ role: 'admin', mei: false })
    mockFetchMeiBillingStatus.mockResolvedValue({
      required: true,
      phase: 'planos',
      maxMei: 0,
      hasActiveSubscription: false,
    })
    await expect(resolveMeiBillingHref()).resolves.toBe('/(app)/planos')
  })
})
