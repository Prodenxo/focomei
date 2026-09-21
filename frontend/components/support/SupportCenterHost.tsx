import React from 'react'
import { SupportTicketCenterModal } from './SupportTicketCenterModal'
import { useSupportCenterStore } from '@/store/supportCenterStore'

/** Central montada uma única vez no app: abre pelo sino, pelas notificações ou por Configurações. */
export function SupportCenterHost () {
  const open = useSupportCenterStore((state) => state.open)
  const focusTicketId = useSupportCenterStore((state) => state.focusTicketId)
  const closeCenter = useSupportCenterStore((state) => state.closeCenter)
  const setUnreadCount = useSupportCenterStore((state) => state.setUnreadCount)

  return (
    <SupportTicketCenterModal
      visible={open}
      focusTicketId={focusTicketId}
      onClose={closeCenter}
      onUnreadChange={setUnreadCount}
    />
  )
}
