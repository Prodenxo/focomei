import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MfScrollView } from '@/components/ui/MfScrollView'
import { useMfTheme } from '@/components/ui/useMfTheme'
import { getTechTokens } from '@/lib/techDesign'
import { mfRadius, mfSpacing } from '@/lib/theme'
import {
  commentSupportTicket,
  getSupportTicketDetail,
  listSupportTickets,
  markSupportTicketRead,
  type SupportTicket,
  type SupportTicketDetail,
} from '@/services/supportService'
import { useAppToastStore } from '@/store/appToastStore'
import { useSupportCenterStore } from '@/store/supportCenterStore'

type Props = {
  visible: boolean
  onClose: () => void
  onUnreadChange?: (count: number) => void
  /** Abre direto na conversa deste chamado (usado pelas notificações). */
  focusTicketId?: number | null
}

const DESKTOP_BREAKPOINT = 900

const formatDateTime = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
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

const PRIORITY_LABEL: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
}

export function SupportTicketCenterModal ({
  visible,
  onClose,
  onUnreadChange,
  focusTicketId = null,
}: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode])
  const { width } = useWindowDimensions()
  const isDesktop = width >= DESKTOP_BREAKPOINT
  const showToast = useAppToastStore((state) => state.show)
  const refreshNotifications = useSupportCenterStore((state) => state.refresh)
  const clearFocus = useSupportCenterStore((state) => state.clearFocus)

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [sending, setSending] = useState(false)
  const [reply, setReply] = useState('')
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const wasVisibleRef = useRef(false)

  /** A conversa também abre por notificação, antes da lista chegar: usa o detalhe como base. */
  const selected = useMemo<SupportTicket | null>(() => {
    if (!selectedId) return null
    const fromList = tickets.find((item) => item.scrumhubTicketId === selectedId)
    if (fromList) return fromList
    const remote = detail?.ticket
    if (!remote) {
      return {
        id: String(selectedId),
        scrumhubTicketId: selectedId,
        nome: 'Chamado',
        concluido: false,
        aprovado: false,
        unreadCount: 0,
      }
    }
    return { ...remote, id: String(selectedId), unreadCount: 0 }
  }, [tickets, selectedId, detail])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const loadTickets = useCallback(async (silent = false) => {
    if (!silent) setLoadingList(true)
    try {
      const result = await listSupportTickets()
      if (!mountedRef.current) return result.tickets
      setTickets(result.tickets)
      setError(null)
      onUnreadChange?.(result.unreadCount)
      return result.tickets
    } catch (err) {
      if (!silent && mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Não foi possível carregar os chamados.')
      }
      return [] as SupportTicket[]
    } finally {
      if (!silent && mountedRef.current) setLoadingList(false)
    }
  }, [onUnreadChange])

  const loadDetail = useCallback(async (ticketId: number, silent = false) => {
    if (!silent) setLoadingDetail(true)
    try {
      const result = await getSupportTicketDetail(ticketId)
      if (!mountedRef.current) return
      setDetail(result)
      setError(null)
      const read = await markSupportTicketRead(ticketId)
      if (!mountedRef.current) return
      onUnreadChange?.(read.unreadCount)
      setTickets((current) => current.map((item) => (
        item.scrumhubTicketId === ticketId ? { ...item, unreadCount: 0 } : item
      )))
      void refreshNotifications()
    } catch (err) {
      if (!silent && mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Não foi possível abrir o chamado.')
      }
    } finally {
      if (!silent && mountedRef.current) setLoadingDetail(false)
    }
  }, [onUnreadChange, refreshNotifications])

  /** Abertura da central: começa sempre pela lista atualizada. */
  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false
      return
    }
    if (wasVisibleRef.current) return
    wasVisibleRef.current = true
    setError(null)
    setReply('')
    setSelectedId(null)
    setDetail(null)
    void loadTickets()
  }, [visible, loadTickets])

  /** Notificação escolhida no sino: entra direto na conversa do chamado. */
  useEffect(() => {
    if (!visible || !focusTicketId) return
    setSelectedId(focusTicketId)
    setDetail(null)
    setReply('')
    setError(null)
    void loadDetail(focusTicketId)
    clearFocus()
  }, [visible, focusTicketId, loadDetail, clearFocus])

  /** Polling leve: conversa aberta atualiza a timeline; lista atualiza os cartões. */
  useEffect(() => {
    if (!visible) return
    const timer = setInterval(() => {
      if (selectedId) void loadDetail(selectedId, true)
      else void loadTickets(true)
    }, 30_000)
    return () => clearInterval(timer)
  }, [visible, selectedId, loadDetail, loadTickets])

  const openTicket = useCallback((ticket: SupportTicket) => {
    setSelectedId(ticket.scrumhubTicketId)
    setDetail(null)
    setReply('')
    setError(null)
    void loadDetail(ticket.scrumhubTicketId)
  }, [loadDetail])

  const backToList = useCallback(() => {
    setSelectedId(null)
    setDetail(null)
    setReply('')
    setError(null)
    void loadTickets(true)
  }, [loadTickets])

  const submitReply = useCallback(async () => {
    if (!selected || !reply.trim() || sending) return
    setSending(true)
    try {
      await commentSupportTicket(selected.scrumhubTicketId, reply.trim())
      setReply('')
      await loadDetail(selected.scrumhubTicketId, true)
      showToast('Resposta enviada para a equipe.', 'success')
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Não foi possível enviar a resposta.',
        'error',
      )
    } finally {
      if (mountedRef.current) setSending(false)
    }
  }, [selected, reply, sending, loadDetail, showToast])

  const styles = useMemo(
    () => createStyles(theme, tokens, isDarkMode, isDesktop),
    [theme, tokens, isDarkMode, isDesktop],
  )

  const statusTone = (ticket: SupportTicket | null) => {
    if (!ticket) return theme.textSecondary
    if (ticket.concluido) return theme.success
    if (!ticket.aprovado) return theme.warning
    return tokens.accent
  }

  const renderList = () => {
    if (loadingList) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={tokens.accent} />
          <Text style={styles.helper}>Carregando seus chamados…</Text>
        </View>
      )
    }
    if (error) {
      return (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { borderColor: theme.error }]}>
            <Ionicons name="alert-circle-outline" size={26} color={theme.error} />
          </View>
          <Text style={styles.emptyTitle}>Não foi possível carregar</Text>
          <Text style={styles.helper}>{error}</Text>
          <Pressable style={styles.primaryButton} onPress={() => void loadTickets()}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.primaryButtonText}>Tentar de novo</Text>
          </Pressable>
        </View>
      )
    }
    if (tickets.length === 0) {
      return (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={26} color={tokens.accent} />
          </View>
          <Text style={styles.emptyTitle}>Nenhum chamado por aqui</Text>
          <Text style={styles.helper}>
            Quando você abrir um chamado, ele aparece aqui com as respostas da equipe.
          </Text>
        </View>
      )
    }

    return (
      <MfScrollView style={styles.scroll} contentContainerStyle={styles.list} hideLegalFooter>
        {tickets.map((ticket) => {
          const tone = statusTone(ticket)
          const priority = ticket.prioridade
            ? PRIORITY_LABEL[ticket.prioridade.toLowerCase()] || ticket.prioridade
            : null
          return (
            <Pressable
              key={ticket.scrumhubTicketId}
              onPress={() => openTicket(ticket)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir chamado ${ticket.codigo || ticket.scrumhubTicketId}`}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={[styles.cardRail, { backgroundColor: tone }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardCode}>
                    {ticket.codigo || `#${ticket.scrumhubTicketId}`}
                  </Text>
                  <View style={styles.cardTopRight}>
                    {ticket.unreadCount > 0 ? (
                      <View style={styles.cardBadge}>
                        <Text style={styles.cardBadgeText}>
                          {ticket.unreadCount > 9 ? '9+' : ticket.unreadCount}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={styles.cardTime}>{formatRelative(ticket.updatedAt)}</Text>
                  </View>
                </View>

                <Text style={styles.cardTitle} numberOfLines={2}>{ticket.nome}</Text>

                <View style={styles.chipRow}>
                  <View style={[styles.chip, { borderColor: tone, backgroundColor: `${tone}1A` }]}>
                    <View style={[styles.chipDot, { backgroundColor: tone }]} />
                    <Text style={[styles.chipText, { color: tone }]}>
                      {ticket.statusNome || (ticket.concluido ? 'Concluído' : 'Em andamento')}
                    </Text>
                  </View>
                  {priority ? (
                    <View style={styles.chipNeutral}>
                      <Ionicons name="flag-outline" size={11} color={theme.textSecondary} />
                      <Text style={styles.chipNeutralText}>{priority}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
            </Pressable>
          )
        })}
      </MfScrollView>
    )
  }

  const renderConversation = () => {
    if (loadingDetail && !detail) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={tokens.accent} />
          <Text style={styles.helper}>Abrindo conversa…</Text>
        </View>
      )
    }
    if (error && !detail) {
      return (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { borderColor: theme.error }]}>
            <Ionicons name="alert-circle-outline" size={26} color={theme.error} />
          </View>
          <Text style={styles.emptyTitle}>Não foi possível abrir</Text>
          <Text style={styles.helper}>{error}</Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => selectedId && void loadDetail(selectedId)}
          >
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.primaryButtonText}>Tentar de novo</Text>
          </Pressable>
        </View>
      )
    }

    const timeline = detail?.timeline || []
    const tone = statusTone(selected)

    return (
      <>
        <MfScrollView style={styles.scroll} contentContainerStyle={styles.timeline} hideLegalFooter>
          <View style={styles.statusPanel}>
            <View style={[styles.chip, { borderColor: tone, backgroundColor: `${tone}1A` }]}>
              <View style={[styles.chipDot, { backgroundColor: tone }]} />
              <Text style={[styles.chipText, { color: tone }]}>
                {detail?.ticket?.statusNome
                  || selected?.statusNome
                  || (selected?.concluido ? 'Concluído' : 'Em andamento')}
              </Text>
            </View>
            {selected?.prioridade ? (
              <View style={styles.chipNeutral}>
                <Ionicons name="flag-outline" size={11} color={theme.textSecondary} />
                <Text style={styles.chipNeutralText}>
                  {PRIORITY_LABEL[selected.prioridade.toLowerCase()] || selected.prioridade}
                </Text>
              </View>
            ) : null}
          </View>

          {timeline.length === 0 ? (
            <View style={styles.emptyThread}>
              <Ionicons name="time-outline" size={20} color={theme.textTertiary} />
              <Text style={styles.helper}>
                Sem respostas ainda. Assim que a equipe comentar, você recebe aviso aqui e no WhatsApp.
              </Text>
            </View>
          ) : timeline.map((item) => {
            const mine = item.external
            return (
              <View
                key={item.id}
                style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTeam]}
              >
                {!mine ? (
                  <View style={styles.avatar}>
                    <Ionicons name="headset-outline" size={14} color={tokens.accent} />
                  </View>
                ) : null}
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTeam]}>
                  <Text style={[styles.bubbleAuthor, mine && styles.bubbleAuthorMine]}>
                    {mine ? 'Você' : item.authorName || 'Equipe FocoMEI'}
                  </Text>
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                    {item.text}
                  </Text>
                  {item.createdAt ? (
                    <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                      {formatDateTime(item.createdAt)}
                    </Text>
                  ) : null}
                </View>
              </View>
            )
          })}
        </MfScrollView>

        <View style={styles.composer}>
          {selected?.concluido ? (
            <View style={styles.completedBar}>
              <Ionicons name="checkmark-circle" size={18} color={theme.success} />
              <Text style={styles.completedText}>Ticket concluído pela equipe</Text>
            </View>
          ) : (
            <>
              <TextInput
                value={reply}
                onChangeText={setReply}
                placeholder="Escreva sua resposta para a equipe…"
                placeholderTextColor={theme.placeholder}
                multiline
                maxLength={5000}
                style={styles.input}
                accessibilityLabel="Resposta do chamado"
              />
              <Pressable
                onPress={() => void submitReply()}
                disabled={!reply.trim() || sending}
                accessibilityRole="button"
                accessibilityLabel="Enviar resposta"
                style={[styles.sendButton, (!reply.trim() || sending) && styles.disabled]}
              >
                {sending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="arrow-up" size={20} color="#fff" />}
              </Pressable>
            </>
          )}
        </View>
      </>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet} edges={['top', 'bottom']}>
          <View style={styles.header}>
            {selected ? (
              <Pressable
                onPress={backToList}
                style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
                accessibilityRole="button"
                accessibilityLabel="Voltar para a lista de chamados"
              >
                <Ionicons name="arrow-back" size={20} color={theme.text} />
              </Pressable>
            ) : (
              <View style={[styles.iconButton, styles.iconGhost]}>
                <Ionicons name="chatbubbles-outline" size={18} color={tokens.accent} />
              </View>
            )}

            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {selected
                  ? selected.codigo || `Chamado #${selected.scrumhubTicketId}`
                  : 'Meus chamados'}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {selected ? selected.nome : 'Acompanhe e responda a equipe FocoMEI'}
              </Text>
            </View>

            {!selected ? (
              <Pressable
                onPress={() => void loadTickets()}
                style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
                accessibilityRole="button"
                accessibilityLabel="Atualizar chamados"
              >
                <Ionicons name="refresh" size={18} color={theme.textSecondary} />
              </Pressable>
            ) : null}

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
              accessibilityRole="button"
              accessibilityLabel="Fechar central de chamados"
            >
              <Ionicons name="close" size={20} color={theme.text} />
            </Pressable>
          </View>

          {selected ? renderConversation() : renderList()}
        </SafeAreaView>
      </View>
    </Modal>
  )
}

function createStyles (
  theme: ReturnType<typeof useMfTheme>['theme'],
  tokens: ReturnType<typeof getTechTokens>,
  isDarkMode: boolean,
  isDesktop: boolean,
) {
  const surface = isDarkMode ? '#0A2248' : '#ffffff'
  const inset = isDarkMode ? 'rgba(7, 24, 48, 0.72)' : '#F3F6FB'

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isDarkMode ? 'rgba(2, 10, 24, 0.72)' : 'rgba(13, 43, 94, 0.32)',
      alignItems: 'center',
      justifyContent: isDesktop ? 'center' : 'flex-end',
      padding: isDesktop ? mfSpacing.lg : 0,
    },
    sheet: {
      width: '100%',
      maxWidth: isDesktop ? 760 : undefined,
      height: isDesktop ? '88%' : '100%',
      backgroundColor: surface,
      borderRadius: isDesktop ? mfRadius.lg : 0,
      overflow: 'hidden',
      borderWidth: isDesktop ? 1 : 0,
      borderColor: tokens.panelBorder,
      ...(Platform.OS === 'web' && isDesktop
        ? ({ boxShadow: tokens.panelShadow } as object)
        : {}),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      paddingHorizontal: mfSpacing.md,
      paddingVertical: mfSpacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: tokens.divider,
      backgroundColor: isDarkMode ? 'rgba(7, 24, 48, 0.6)' : '#FFFFFF',
    },
    iconButton: {
      width: 38,
      height: 38,
      borderRadius: mfRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: tokens.insetFill,
    },
    iconGhost: {
      borderColor: tokens.panelBorder,
      backgroundColor: tokens.accentSoft,
    },
    iconPressed: { opacity: 0.7 },
    headerCopy: { flex: 1, minWidth: 0, gap: 2 },
    headerTitle: { fontSize: 16, fontWeight: '800', color: theme.text, letterSpacing: -0.2 },
    headerSubtitle: { fontSize: 12, color: theme.textSecondary },

    scroll: { flex: 1 },
    list: { padding: mfSpacing.md, gap: mfSpacing.sm },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: mfSpacing.sm,
      padding: mfSpacing.xl,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: tokens.panelBorder,
      backgroundColor: tokens.accentSoft,
      marginBottom: 4,
    },
    emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.text },
    helper: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.textSecondary,
      textAlign: 'center',
      maxWidth: 420,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: mfRadius.pill,
      backgroundColor: tokens.accent,
    },
    primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },

    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      paddingRight: mfSpacing.md,
      borderRadius: mfRadius.md,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: inset,
      overflow: 'hidden',
    },
    cardPressed: { opacity: 0.75 },
    cardRail: { width: 4, alignSelf: 'stretch' },
    cardBody: { flex: 1, gap: 7, paddingVertical: mfSpacing.md, paddingLeft: mfSpacing.sm },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardCode: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      color: tokens.accent,
    },
    cardTime: { fontSize: 11, color: theme.textTertiary },
    cardTitle: { fontSize: 15, fontWeight: '700', color: theme.text, lineHeight: 20 },
    cardBadge: {
      minWidth: 20,
      height: 20,
      paddingHorizontal: 6,
      borderRadius: 10,
      backgroundColor: theme.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

    chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: mfRadius.pill,
      borderWidth: 1,
    },
    chipDot: { width: 6, height: 6, borderRadius: 3 },
    chipText: { fontSize: 11, fontWeight: '700' },
    chipNeutral: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: mfRadius.pill,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
    },
    chipNeutralText: { fontSize: 11, fontWeight: '600', color: theme.textSecondary },

    timeline: { padding: mfSpacing.md, gap: mfSpacing.sm },
    statusPanel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
      paddingBottom: 4,
    },
    emptyThread: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: mfSpacing.xl,
    },
    bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '100%' },
    bubbleRowMine: { justifyContent: 'flex-end' },
    bubbleRowTeam: { justifyContent: 'flex-start' },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: tokens.panelBorder,
      backgroundColor: tokens.accentSoft,
    },
    bubble: {
      maxWidth: '82%',
      minWidth: 110,
      paddingHorizontal: 13,
      paddingVertical: 10,
      borderRadius: mfRadius.md,
      borderWidth: 1,
    },
    bubbleTeam: {
      backgroundColor: inset,
      borderColor: tokens.insetBorder,
      borderBottomLeftRadius: 4,
    },
    bubbleMine: {
      backgroundColor: tokens.accent,
      borderColor: tokens.accent,
      borderBottomRightRadius: 4,
    },
    bubbleAuthor: {
      fontSize: 11,
      fontWeight: '800',
      marginBottom: 4,
      color: theme.textSecondary,
    },
    bubbleAuthorMine: { color: 'rgba(255, 255, 255, 0.85)' },
    bubbleText: { fontSize: 14, lineHeight: 20, color: theme.text },
    bubbleTextMine: { color: '#fff' },
    bubbleTime: { fontSize: 10, marginTop: 6, textAlign: 'right', color: theme.textTertiary },
    bubbleTimeMine: { color: 'rgba(255, 255, 255, 0.75)' },

    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 9,
      padding: mfSpacing.md,
      borderTopWidth: 1,
      borderTopColor: tokens.divider,
      backgroundColor: isDarkMode ? 'rgba(7, 24, 48, 0.6)' : '#FFFFFF',
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: mfRadius.md,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: inset,
      color: theme.text,
      fontSize: 14,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: mfRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.accent,
    },
    disabled: { opacity: 0.4 },
    completedBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 10,
      borderRadius: mfRadius.md,
      borderWidth: 1,
      borderColor: `${theme.success}55`,
      backgroundColor: `${theme.success}14`,
    },
    completedText: { fontSize: 13, fontWeight: '800', color: theme.success },
  })
}
