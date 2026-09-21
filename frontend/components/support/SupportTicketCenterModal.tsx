import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MfScrollView } from '@/components/ui/MfScrollView'
import { useMfTheme } from '@/components/ui/useMfTheme'
import {
  commentSupportTicket,
  getSupportTicketDetail,
  listSupportTickets,
  markSupportTicketRead,
  type SupportTicket,
  type SupportTicketDetail,
} from '@/services/supportService'
import { useAppToastStore } from '@/store/appToastStore'

type Props = {
  visible: boolean
  onClose: () => void
  onUnreadChange?: (count: number) => void
}

const formatDate = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function SupportTicketCenterModal ({
  visible,
  onClose,
  onUnreadChange,
}: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const showToast = useAppToastStore((state) => state.show)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selected, setSelected] = useState<SupportTicket | null>(null)
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [sending, setSending] = useState(false)
  const [reply, setReply] = useState('')
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const loadTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const result = await listSupportTickets()
      if (!mountedRef.current) return
      setTickets(result.tickets)
      setError(null)
      onUnreadChange?.(result.unreadCount)
    } catch (err) {
      if (!silent && mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Não foi possível carregar os chamados.')
      }
    } finally {
      if (!silent && mountedRef.current) setLoading(false)
    }
  }, [onUnreadChange])

  const loadDetail = useCallback(async (ticket: SupportTicket, silent = false) => {
    if (!silent) setLoadingDetail(true)
    try {
      const result = await getSupportTicketDetail(ticket.scrumhubTicketId)
      if (!mountedRef.current) return
      setDetail(result)
      const read = await markSupportTicketRead(ticket.scrumhubTicketId)
      if (!mountedRef.current) return
      onUnreadChange?.(read.unreadCount)
      setTickets((current) => current.map((item) => (
        item.scrumhubTicketId === ticket.scrumhubTicketId
          ? { ...item, unreadCount: 0 }
          : item
      )))
      setError(null)
    } catch (err) {
      if (!silent && mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Não foi possível abrir o chamado.')
      }
    } finally {
      if (!silent && mountedRef.current) setLoadingDetail(false)
    }
  }, [onUnreadChange])

  useEffect(() => {
    mountedRef.current = true
    if (!visible) return () => { mountedRef.current = false }
    setSelected(null)
    setDetail(null)
    setReply('')
    void loadTickets()
    const timer = setInterval(() => {
      if (selected) void loadDetail(selected, true)
      else void loadTickets(true)
    }, 30_000)
    return () => {
      mountedRef.current = false
      clearInterval(timer)
    }
  }, [visible, selected, loadDetail, loadTickets])

  const openTicket = (ticket: SupportTicket) => {
    setSelected(ticket)
    setDetail(null)
    setReply('')
    void loadDetail(ticket)
  }

  const submitReply = async () => {
    if (!selected || !reply.trim() || sending) return
    setSending(true)
    try {
      await commentSupportTicket(selected.scrumhubTicketId, reply.trim())
      setReply('')
      await loadDetail(selected, true)
      showToast('Resposta enviada!', 'success')
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Não foi possível enviar a resposta.',
        'error',
      )
    } finally {
      setSending(false)
    }
  }

  const surface = isDarkMode ? '#071a36' : '#ffffff'
  const inset = isDarkMode ? '#041228' : '#f4f7fb'

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: surface }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          {selected ? (
            <Pressable
              onPress={() => {
                setSelected(null)
                setDetail(null)
                void loadTickets(true)
              }}
              style={styles.iconButton}
              accessibilityLabel="Voltar aos chamados"
            >
              <Ionicons name="arrow-back" size={22} color={theme.text} />
            </Pressable>
          ) : <View style={styles.iconButton} />}
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: theme.text }]}>
              {selected ? selected.codigo || `Chamado #${selected.scrumhubTicketId}` : 'Meus chamados'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {selected ? selected.nome : 'Acompanhe e responda à equipe FocoMEI'}
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.iconButton} accessibilityLabel="Fechar">
            <Ionicons name="close" size={23} color={theme.text} />
          </Pressable>
        </View>

        {loading || loadingDetail ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.helper, { color: theme.textSecondary }]}>Carregando…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={32} color={theme.error} />
            <Text style={[styles.helper, { color: theme.text }]}>{error}</Text>
            <Pressable
              style={[styles.retry, { backgroundColor: theme.primary }]}
              onPress={() => selected ? void loadDetail(selected) : void loadTickets()}
            >
              <Text style={styles.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : selected ? (
          <>
            <MfScrollView
              style={styles.scroll}
              contentContainerStyle={styles.timeline}
              hideLegalFooter
            >
              <View style={[styles.statusCard, { backgroundColor: inset, borderColor: theme.border }]}>
                <View>
                  <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Status</Text>
                  <Text style={[styles.statusValue, { color: selected.concluido ? theme.success : theme.warning }]}>
                    {detail?.ticket?.statusNome || selected.statusNome || 'Pendente'}
                  </Text>
                </View>
                {selected.prioridade ? (
                  <Text style={[styles.priority, { color: theme.textSecondary }]}>
                    Prioridade {selected.prioridade}
                  </Text>
                ) : null}
              </View>

              {(detail?.timeline || []).length === 0 ? (
                <Text style={[styles.helper, { color: theme.textSecondary }]}>
                  Ainda não há comentários neste chamado.
                </Text>
              ) : (detail?.timeline || []).map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.message,
                    {
                      backgroundColor: item.external ? theme.primary : inset,
                      borderColor: item.external ? theme.primary : theme.border,
                      alignSelf: item.external ? 'flex-end' : 'flex-start',
                    },
                  ]}
                >
                  <Text style={[
                    styles.author,
                    { color: item.external ? '#fff' : theme.textSecondary },
                  ]}>
                    {item.external ? 'Você' : item.authorName || 'Equipe FocoMEI'}
                  </Text>
                  <Text style={[
                    styles.messageText,
                    { color: item.external ? '#fff' : theme.text },
                  ]}>
                    {item.text}
                  </Text>
                  {item.createdAt ? (
                    <Text style={[
                      styles.messageDate,
                      { color: item.external ? 'rgba(255,255,255,0.75)' : theme.textSecondary },
                    ]}>
                      {formatDate(item.createdAt)}
                    </Text>
                  ) : null}
                </View>
              ))}
            </MfScrollView>

            <View style={[styles.composer, { borderTopColor: theme.border, backgroundColor: surface }]}>
              {selected.concluido ? (
                <View style={styles.completed}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                  <Text style={[styles.completedText, { color: theme.success }]}>
                    Ticket concluído
                  </Text>
                </View>
              ) : (
                <>
                  <TextInput
                    value={reply}
                    onChangeText={setReply}
                    placeholder="Escreva sua resposta…"
                    placeholderTextColor={theme.placeholder}
                    multiline
                    maxLength={5000}
                    style={[
                      styles.input,
                      { color: theme.text, backgroundColor: inset, borderColor: theme.border },
                    ]}
                  />
                  <Pressable
                    onPress={() => void submitReply()}
                    disabled={!reply.trim() || sending}
                    style={[
                      styles.sendButton,
                      { backgroundColor: theme.primary },
                      (!reply.trim() || sending) && styles.disabled,
                    ]}
                  >
                    {sending
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="send" size={20} color="#fff" />}
                  </Pressable>
                </>
              )}
            </View>
          </>
        ) : tickets.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="ticket-outline" size={38} color={theme.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Nenhum chamado ainda</Text>
            <Text style={[styles.helper, { color: theme.textSecondary }]}>
              Seus chamados aparecerão aqui depois que forem abertos.
            </Text>
          </View>
        ) : (
          <MfScrollView style={styles.scroll} contentContainerStyle={styles.list} hideLegalFooter>
            {tickets.map((ticket) => (
              <Pressable
                key={ticket.scrumhubTicketId}
                onPress={() => openTicket(ticket)}
                style={({ pressed }) => [
                  styles.ticketCard,
                  { backgroundColor: inset, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.ticketMain}>
                  <View style={styles.ticketTitleRow}>
                    <Text style={[styles.ticketCode, { color: theme.primary }]}>
                      {ticket.codigo || `#${ticket.scrumhubTicketId}`}
                    </Text>
                    {ticket.unreadCount > 0 ? (
                      <View style={[styles.badge, { backgroundColor: theme.error }]}>
                        <Text style={styles.badgeText}>{ticket.unreadCount}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.ticketName, { color: theme.text }]} numberOfLines={2}>
                    {ticket.nome}
                  </Text>
                  <Text style={[styles.ticketMeta, { color: theme.textSecondary }]}>
                    {ticket.statusNome || (ticket.concluido ? 'Concluído' : 'Pendente')}
                    {ticket.updatedAt ? ` · ${formatDate(ticket.updatedAt)}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </Pressable>
            ))}
          </MfScrollView>
        )}
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    minHeight: 70,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  scroll: { flex: 1 },
  list: { padding: 16, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 12 },
  helper: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  retry: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
  ticketCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressed: { opacity: 0.72 },
  ticketMain: { flex: 1, gap: 5 },
  ticketTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticketCode: { fontSize: 12, fontWeight: '800' },
  ticketName: { fontSize: 15, fontWeight: '700' },
  ticketMeta: { fontSize: 12 },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  timeline: { padding: 16, gap: 12 },
  statusCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: { fontSize: 11 },
  statusValue: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  priority: { fontSize: 12, textTransform: 'capitalize' },
  message: {
    maxWidth: '86%',
    minWidth: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
  },
  author: { fontSize: 11, fontWeight: '800', marginBottom: 5 },
  messageText: { fontSize: 14, lineHeight: 20 },
  messageDate: { fontSize: 10, marginTop: 6, textAlign: 'right' },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  completed: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  completedText: { fontSize: 14, fontWeight: '800' },
})
