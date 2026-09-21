import { useEffect, useRef } from 'react'
import {
  getSupportUnreadCount,
  listSupportNotifications,
} from '@/services/supportService'
import { useAppToastStore } from '@/store/appToastStore'

type Props = {
  userId?: string | null
}

/** Aviso efêmero global; a central em Configurações mantém o histórico e o badge. */
export function SupportNotificationWatcher ({ userId }: Props) {
  const showToast = useAppToastStore((state) => state.show)
  const previousRef = useRef<number | null>(null)

  useEffect(() => {
    if (!userId) {
      previousRef.current = null
      return
    }
    let active = true
    const check = async () => {
      try {
        const [count, notifications] = await Promise.all([
          getSupportUnreadCount(),
          listSupportNotifications(),
        ])
        if (!active) return
        const previous = previousRef.current
        if (count > 0 && (previous === null || count > previous)) {
          const latestUnread = notifications.find((item) => !item.readAt)
          showToast(
            latestUnread?.eventType === 'completed'
              ? 'Ticket concluído'
              : latestUnread?.title || (
                count === 1
                  ? 'Você tem uma nova atualização em um chamado.'
                  : `Você tem ${count} atualizações novas em chamados.`
              ),
            latestUnread?.eventType === 'completed' ? 'success' : 'info',
          )
        }
        previousRef.current = count
      } catch {
        /* a verificação de suporte nunca bloqueia o uso do app */
      }
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
