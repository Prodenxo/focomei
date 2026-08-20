import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import { useAuthStore } from '@/store/authStore'

const KEY_PREFIX = 'mei_contract_pending_v1'

export interface MeiContractPendingSession {
  lineId?: string
  signingUrl?: string | null
  contratoOnetyId?: number | null
  savedAt: string
}

function resolveStorageKey (): string {
  const userId = useAuthStore.getState().user?.id?.trim()
  return userId ? `${KEY_PREFIX}:${userId}` : KEY_PREFIX
}

export function hasMeiContractPendingSession (
  data: MeiContractPendingSession | null | undefined,
): boolean {
  return Boolean(data?.lineId || data?.contratoOnetyId)
}

export async function stashMeiContractPendingSession (
  data: Omit<MeiContractPendingSession, 'savedAt'>,
): Promise<void> {
  const payload: MeiContractPendingSession = {
    ...data,
    savedAt: new Date().toISOString(),
  }
  const json = JSON.stringify(payload)
  const key = resolveStorageKey()
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, json)
    return
  }
  await AsyncStorage.setItem(key, json)
}

export async function readMeiContractPendingSession (): Promise<MeiContractPendingSession | null> {
  try {
    const key = resolveStorageKey()
    let json: string | null = null
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      json = localStorage.getItem(key)
    } else {
      json = await AsyncStorage.getItem(key)
    }
    if (!json) return null
    return JSON.parse(json) as MeiContractPendingSession
  } catch {
    return null
  }
}

export async function clearMeiContractPendingSession (): Promise<void> {
  try {
    const key = resolveStorageKey()
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(key)
      return
    }
    await AsyncStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}
