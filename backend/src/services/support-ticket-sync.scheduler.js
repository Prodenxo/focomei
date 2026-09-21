import { env } from '../config/env.js'
import {
  deliverPendingSupportWhatsapp,
  syncOpenSupportTickets,
} from './support-ticket-center.service.js'

let timer = null
let running = false

const enabled = () =>
  !['false', '0', 'off'].includes(String(env.SCRUMHUB_SYNC_ENABLED || '').toLowerCase())

const intervalMs = () => {
  const value = Number(env.SCRUMHUB_SYNC_INTERVAL_MS)
  return Number.isFinite(value) && value >= 60_000 ? value : 5 * 60 * 1000
}

export const runSupportTicketSync = async () => {
  if (running) return { skipped: true, reason: 'already_running' }
  running = true
  try {
    const sync = await syncOpenSupportTickets()
    const whatsapp = await deliverPendingSupportWhatsapp()
    return { sync, whatsapp }
  } finally {
    running = false
  }
}

export const startSupportTicketSyncScheduler = () => {
  if (!enabled() || timer) return { started: false }
  const run = () => {
    void runSupportTicketSync().catch((error) => {
      console.warn(
        '[support-ticket-sync] falha',
        error instanceof Error ? error.message : error,
      )
    })
  }
  timer = setInterval(run, intervalMs())
  timer.unref?.()
  setTimeout(run, 10_000).unref?.()
  return { started: true, intervalMs: intervalMs() }
}

export const stopSupportTicketSyncScheduler = () => {
  if (!timer) return
  clearInterval(timer)
  timer = null
}
