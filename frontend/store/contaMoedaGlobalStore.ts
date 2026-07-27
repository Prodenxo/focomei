import { create } from 'zustand'
import { apiClient } from '../lib/apiClient'
import { useAuthStore } from './authStore'
import { formatContaMoedaGlobalDbError } from '../lib/errors'
import {
  normalizeContaMoedaGlobalRow,
  type ContaMoedaGlobal,
  type ContaMoedaGlobalInput,
} from '../lib/contaMoedaGlobalTypes'

interface ContaMoedaGlobalState {
  contas: ContaMoedaGlobal[]
  loading: boolean
  error: string | null
  fetchContas: () => Promise<void>
  addConta: (input: ContaMoedaGlobalInput) => Promise<ContaMoedaGlobal | null>
  updateConta: (id: string, input: Partial<ContaMoedaGlobalInput>) => Promise<{ error: string | null }>
  deleteConta: (id: string) => Promise<{ error: string | null }>
}

function toApiPayload(input: ContaMoedaGlobalInput | Partial<ContaMoedaGlobalInput>) {
  const payload: Record<string, unknown> = { ...input }
  if ('moeda' in payload && payload.moeda != null) {
    payload.moeda = String(payload.moeda).trim().toUpperCase()
  }
  if ('valor' in payload && payload.valor != null) {
    payload.valor = Number(payload.valor)
  }
  if ('nome' in payload) {
    const n = payload.nome != null ? String(payload.nome).trim() : ''
    payload.nome = n || null
  }
  return payload
}

export const useContaMoedaGlobalStore = create<ContaMoedaGlobalState>((set, get) => ({
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
        '/contas-moeda-global',
      )
      set({
        contas: (data?.contas || []).map((row) => normalizeContaMoedaGlobalRow(row)),
        loading: false,
      })
    } catch (err: unknown) {
      set({ error: formatContaMoedaGlobalDbError(err), loading: false })
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
        '/contas-moeda-global',
        toApiPayload(input),
      )
      await get().fetchContas()
      return data?.conta ? normalizeContaMoedaGlobalRow(data.conta) : null
    } catch (err: unknown) {
      set({ error: formatContaMoedaGlobalDbError(err) })
      return null
    }
  },

  updateConta: async (id, input) => {
    const userId = useAuthStore.getState().userId
    if (!userId) return { error: 'Usuário não autenticado' }
    try {
      await apiClient.put(
        `/contas-moeda-global/${encodeURIComponent(id)}`,
        toApiPayload(input),
      )
      await get().fetchContas()
      return { error: null }
    } catch (err: unknown) {
      const msg = formatContaMoedaGlobalDbError(err)
      set({ error: msg })
      return { error: msg }
    }
  },

  deleteConta: async (id) => {
    const userId = useAuthStore.getState().userId
    if (!userId) return { error: 'Usuário não autenticado' }
    try {
      await apiClient.delete(`/contas-moeda-global/${encodeURIComponent(id)}`)
      await get().fetchContas()
      return { error: null }
    } catch (err: unknown) {
      const msg = formatContaMoedaGlobalDbError(err)
      set({ error: msg })
      return { error: msg }
    }
  },
}))
