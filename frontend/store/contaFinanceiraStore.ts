import { create } from 'zustand'
import { apiClient } from '../lib/apiClient'
import { useAuthStore } from './authStore'
import { formatContaFinanceiraDbError } from '../lib/errors'
import {
  normalizeContaRow,
  type ContaFinanceira,
  type ContaFinanceiraInput,
} from '../lib/contaFinanceiraTypes'

interface ContaFinanceiraState {
  contas: ContaFinanceira[]
  loading: boolean
  error: string | null
  fetchContas: () => Promise<void>
  addConta: (input: ContaFinanceiraInput) => Promise<ContaFinanceira | null>
  updateConta: (id: string, input: Partial<ContaFinanceiraInput>) => Promise<{ error: string | null }>
  deleteConta: (id: string) => Promise<{ error: string | null }>
}

function toApiPayload (input: ContaFinanceiraInput | Partial<ContaFinanceiraInput>) {
  const payload: Record<string, unknown> = { ...input }
  if ('saldo_inicial' in payload && payload.saldo_inicial != null) {
    payload.saldo_inicial = Number(payload.saldo_inicial)
  }
  if ('limite_credito' in payload) {
    payload.limite_credito =
      payload.limite_credito == null || payload.limite_credito === ''
        ? null
        : Number(payload.limite_credito)
  }
  return payload
}

export const useContaFinanceiraStore = create<ContaFinanceiraState>((set, get) => ({
  contas: [],
  loading: false,
  error: null,

  fetchContas: async () => {
    const userId = useAuthStore.getState().userId
    if (!userId) {
      set({ error: 'Usuário não autenticado' })
      return
    }
    set({ loading: true, error: null })
    try {
      const data = await apiClient.get<{ contas: Record<string, unknown>[] }>(
        '/contas-financeiras?includeInactive=1',
      )
      set({
        contas: (data?.contas || []).map((row) => normalizeContaRow(row)),
        loading: false,
      })
    } catch (err: unknown) {
      set({ error: formatContaFinanceiraDbError(err), loading: false })
    }
  },

  addConta: async (input) => {
    const userId = useAuthStore.getState().userId
    if (!userId) {
      set({ error: 'Usuário não autenticado' })
      return null
    }
    try {
      const data = await apiClient.post<{ conta: Record<string, unknown> }>(
        '/contas-financeiras',
        toApiPayload(input),
      )
      await get().fetchContas()
      return data?.conta ? normalizeContaRow(data.conta) : null
    } catch (err: unknown) {
      set({ error: formatContaFinanceiraDbError(err) })
      return null
    }
  },

  updateConta: async (id, input) => {
    const userId = useAuthStore.getState().userId
    if (!userId) return { error: 'Usuário não autenticado' }
    try {
      await apiClient.put(`/contas-financeiras/${encodeURIComponent(id)}`, toApiPayload(input))
      await get().fetchContas()
      return { error: null }
    } catch (err: unknown) {
      const msg = formatContaFinanceiraDbError(err)
      set({ error: msg })
      return { error: msg }
    }
  },

  deleteConta: async (id) => {
    const userId = useAuthStore.getState().userId
    if (!userId) return { error: 'Usuário não autenticado' }
    try {
      await apiClient.delete(`/contas-financeiras/${encodeURIComponent(id)}`)
      await get().fetchContas()
      return { error: null }
    } catch (err: unknown) {
      const msg = formatContaFinanceiraDbError(err)
      set({ error: msg })
      return { error: msg }
    }
  },
}))
