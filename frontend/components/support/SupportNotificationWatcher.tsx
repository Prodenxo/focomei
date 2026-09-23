import { useEffect, useRef } from 'react'
import { useAppToastStore } from '@/store/appToastStore'
import { useSupportCenterStore } from '@/store/supportCenterStore'

type Props = {
  userId?: string | null
}

/** Mantém badge e histórico do sino em dia e avisa no app quando chega novidade. */
export function SupportNotificationWatcher ({ userId }: Props) {
  const showToast = useAppToastStore((state) => state.show)
  const previousRef = useRef<number | null>(null)

  useEffect(() => {
    if (!userId) {
      previousRef.current = null
      useSupportCenterStore.getState().reset()
      return
    }

    let active = true
    const check = async () => {
      await useSupportCenterStore.getState().refresh()
      if (!active) return

      const { unreadCount, notifications } = useSupportCenterStore.getState()
      const previous = previousRef.current
      if (unreadCount > 0 && previous !== null && unreadCount > previous) {
        const latest = notifications.find((item) => !item.readAt)
        showToast(
          latest?.eventType === 'completed'
            ? `Ticket concluído${latest.codigo ? ` · ${latest.codigo}` : ''}`
            : latest?.title || 'Você tem uma nova atualização em um chamado.',
          latest?.eventType === 'completed' ? 'success' : 'info',
        )
      }
      previousRef.current = unreadCount
    }

    void check()
    const timer = setInterval(check, 60_000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [showToast, userId])

  return null
}
