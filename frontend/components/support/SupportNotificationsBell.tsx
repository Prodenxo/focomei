import React, { useCallback, useMemo, useState } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMfTheme } from '@/components/ui/useMfTheme'
import { getTechTokens } from '@/lib/techDesign'
import { mfRadius, mfSpacing } from '@/lib/theme'
import { useSupportCenterStore } from '@/store/supportCenterStore'
import type { SupportNotification } from '@/services/supportService'

type Props = {
  /** Usa o layout compacto do topo em telas estreitas. */
  compact?: boolean
}

const formatRelative = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const diffMin = Math.round((Date.now() - date.getTime()) / 60_000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `há ${diffH} h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 30) return `há ${diffD} d`
  return date.toLocaleDateString('pt-BR')
}

export function SupportNotificationsBell ({ compact = false }: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode])
  const [open, setOpen] = useState(false)

  const unreadCount = useSupportCenterStore((state) => state.unreadCount)
  const notifications = useSupportCenterStore((state) => state.notifications)
  const refresh = useSupportCenterStore((state) => state.refresh)
  const markRead = useSupportCenterStore((state) => state.markRead)
  const markAllRead = useSupportCenterStore((state) => state.markAllRead)
  const openCenter = useSupportCenterStore((state) => state.openCenter)

  const styles = useMemo(
    () => createStyles(theme, tokens, isDarkMode, compact),
    [theme, tokens, isDarkMode, compact],
  )

  const togglePanel = useCallback(() => {
    setOpen((current) => {
      if (!current) void refresh()
      return !current
    })
  }, [refresh])

  const handleSelect = useCallback((item: SupportNotification) => {
    setOpen(false)
    if (!item.readAt) void markRead(item.id)
    openCenter(item.scrumhubTicketId)
  }, [markRead, openCenter])

  return (
    <>
      <Pressable
        onPress={togglePanel}
        style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={
          unreadCount > 0
            ? `Notificações: ${unreadCount} não lidas`
            : 'Notificações'
        }
      >
        <Ionicons
          name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
          size={18}
          color={unreadCount > 0 ? tokens.accent : theme.textSecondary}
        />
        {unreadCount > 0 ? (
          <View style={styles.bellBadge}>
            <Text style={styles.bellBadgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={styles.overlay}
          onPress={() => setOpen(false)}
          accessibilityLabel="Fechar notificações"
        >
          <Pressable style={styles.panel} onPress={(event) => event.stopPropagation()}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Notificações</Text>
              {unreadCount > 0 ? (
                <Pressable
                  onPress={() => void markAllRead()}
                  accessibilityRole="button"
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <Text style={styles.panelAction}>Marcar todas como lidas</Text>
                </Pressable>
              ) : null}
            </View>

            {notifications.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="notifications-off-outline" size={22} color={theme.textTertiary} />
                <Text style={styles.emptyText}>
                  Sem novidades. Avisamos aqui e no WhatsApp quando a equipe responder.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.scroll} contentContainerStyle={styles.listContent}>
                {notifications.map((item) => {
                  const done = item.eventType === 'completed'
                  const tone = done ? theme.success : tokens.accent
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => handleSelect(item)}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.item,
                        !item.readAt && styles.itemUnread,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={[styles.itemIcon, { borderColor: tone }]}>
                        <Ionicons
                          name={done ? 'checkmark-done' : 'chatbubble-ellipses-outline'}
                          size={14}
                          color={tone}
                        />
                      </View>
                      <View style={styles.itemBody}>
                        <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                        <Text style={styles.itemMessage} numberOfLines={2}>{item.message}</Text>
                        <Text style={styles.itemTime}>
                          {[item.codigo, formatRelative(item.createdAt)].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      {!item.readAt ? <View style={[styles.dot, { backgroundColor: tone }]} /> : null}
                    </Pressable>
                  )
                })}
              </ScrollView>
            )}

            <Pressable
              onPress={() => {
                setOpen(false)
                openCenter()
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.footer, pressed && styles.pressed]}
            >
              <Ionicons name="chatbubbles-outline" size={15} color={tokens.accent} />
              <Text style={styles.footerText}>Abrir meus chamados</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

function createStyles (
  theme: ReturnType<typeof useMfTheme>['theme'],
  tokens: ReturnType<typeof getTechTokens>,
  isDarkMode: boolean,
  compact: boolean,
) {
  const surface = isDarkMode ? '#0A2248' : '#FFFFFF'

  return StyleSheet.create({
    bellButton: {
      width: compact ? 32 : 34,
      height: compact ? 32 : 34,
      borderRadius: mfRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: tokens.insetFill,
    },
    bellBadge: {
      position: 'absolute',
      top: -5,
      right: -5,
      minWidth: 17,
      height: 17,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor: theme.error,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: surface,
    },
    bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
    pressed: { opacity: 0.7 },

    overlay: {
      flex: 1,
      backgroundColor: isDarkMode ? 'rgba(2, 10, 24, 0.6)' : 'rgba(13, 43, 94, 0.25)',
      alignItems: 'flex-end',
      paddingTop: Platform.OS === 'web' ? 76 : 64,
      paddingHorizontal: mfSpacing.md,
    },
    panel: {
      width: '100%',
      maxWidth: 380,
      maxHeight: 460,
      borderRadius: mfRadius.lg,
      borderWidth: 1,
      borderColor: tokens.panelBorder,
      backgroundColor: surface,
      overflow: 'hidden',
      ...(Platform.OS === 'web' ? ({ boxShadow: tokens.panelShadow } as object) : {}),
    },
    panelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: mfSpacing.sm,
      paddingHorizontal: mfSpacing.md,
      paddingVertical: mfSpacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: tokens.divider,
    },
    panelTitle: { fontSize: 14, fontWeight: '800', color: theme.text },
    panelAction: { fontSize: 11, fontWeight: '700', color: tokens.accent },

    scroll: { maxHeight: 330 },
    listContent: { padding: mfSpacing.sm, gap: 6 },
    item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 10,
      borderRadius: mfRadius.sm,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    itemUnread: {
      borderColor: tokens.insetBorder,
      backgroundColor: tokens.insetFill,
    },
    itemIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    itemBody: { flex: 1, gap: 2 },
    itemTitle: { fontSize: 13, fontWeight: '700', color: theme.text },
    itemMessage: { fontSize: 12, lineHeight: 16, color: theme.textSecondary },
    itemTime: { fontSize: 10, color: theme.textTertiary, marginTop: 2 },
    dot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },

    empty: { alignItems: 'center', gap: 8, padding: mfSpacing.xl },
    emptyText: {
      fontSize: 12,
      lineHeight: 17,
      color: theme.textSecondary,
      textAlign: 'center',
    },

    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingVertical: 11,
      borderTopWidth: 1,
      borderTopColor: tokens.divider,
    },
    footerText: { fontSize: 12, fontWeight: '700', color: tokens.accent },
  })
}
