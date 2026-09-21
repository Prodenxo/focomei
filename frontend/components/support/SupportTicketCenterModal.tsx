import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MfScrollView } from '@/components/ui/MfScrollView'
import { useMfTheme } from '@/components/ui/useMfTheme'
import { getTechTokens } from '@/lib/techDesign'
import { mfRadius, mfSpacing } from '@/lib/theme'
import { SupportRichText } from '@/components/support/SupportRichText'
import {
  commentSupportTicket,
  getAdminSupportTicketDetail,
  getSupportTicketDetail,
  listAdminSupportTickets,
  listSupportTickets,
  markSupportTicketRead,
  replyAdminSupportTicket,
  type SupportTicket,
  type SupportTicketAttachment,
  type SupportTicketDetail,
} from '@/services/supportService'
import { useAppToastStore } from '@/store/appToastStore'
import { useAuthStore } from '@/store/authStore'
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

const IMAGE_PICKER_TYPES = Platform.OS === 'web'
  ? '.png,.jpg,.jpeg,.webp,.gif'
  : ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

/** ScrumHub guarda a imagem como texto, então o backend recusa arquivos grandes. */
const MAX_IMAGE_BYTES = 3 * 1024 * 1024

type Scope = 'mine' | 'all'

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
  const role = useAuthStore((state) => state.role)
  const isSuperAdmin = role === 'superadmin'

  const [scope, setScope] = useState<Scope>('mine')
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null)
  const [requesterLabel, setRequesterLabel] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [sending, setSending] = useState(false)
  const [reply, setReply] = useState('')
  const [attachment, setAttachment] = useState<SupportTicketAttachment | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const wasVisibleRef = useRef(false)
  const isTeamView = scope === 'all'

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
      if (scope === 'all') {
        const all = await listAdminSupportTickets()
        if (!mountedRef.current) return all
        setTickets(all)
        setError(null)
        return all
      }
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
  }, [onUnreadChange, scope])

  const loadDetail = useCallback(async (ticketId: number, silent = false) => {
    if (!silent) setLoadingDetail(true)
    try {
      if (scope === 'all') {
        const admin = await getAdminSupportTicketDetail(ticketId)
        if (!mountedRef.current) return
        setDetail({ ticket: admin.ticket, timeline: admin.timeline })
        setRequesterLabel(admin.solicitante?.nome || admin.solicitante?.email || null)
        setError(null)
        return
      }

      const result = await getSupportTicketDetail(ticketId)
      if (!mountedRef.current) return
      setDetail(result)
      setRequesterLabel(null)
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
  }, [onUnreadChange, refreshNotifications, scope])

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
    setAttachment(null)
    setSelectedId(null)
    setDetail(null)
    if (scope !== 'mine') {
      // Volta para "meus chamados"; o efeito de aba carrega a lista certa em seguida.
      setScope('mine')
      return
    }
    void loadTickets()
  }, [visible, scope, loadTickets])

  /** Alternar entre "meus" e "todos" recomeça pela lista da aba escolhida. */
  const changeScope = useCallback((next: Scope) => {
    setScope(next)
    setSelectedId(null)
    setDetail(null)
    setRequesterLabel(null)
    setReply('')
    setAttachment(null)
    setError(null)
    setTickets([])
  }, [])

  const scopeRef = useRef(scope)
  useEffect(() => {
    if (!visible) return
    if (scopeRef.current === scope) return
    scopeRef.current = scope
    void loadTickets()
  }, [visible, scope, loadTickets])

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
    setAttachment(null)
    setError(null)
    void loadDetail(ticket.scrumhubTicketId)
  }, [loadDetail])

  const backToList = useCallback(() => {
    setSelectedId(null)
    setDetail(null)
    setRequesterLabel(null)
    setReply('')
    setAttachment(null)
    setError(null)
    void loadTickets(true)
  }, [loadTickets])

  const pickImage = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: IMAGE_PICKER_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      })
      if (result.canceled) return
      const asset = result.assets?.[0]
      if (!asset) return
      if ((asset.size ?? 0) > MAX_IMAGE_BYTES) {
        showToast('A imagem precisa ter no máximo 3 MB.', 'error')
        return
      }
      setAttachment({
        uri: asset.uri,
        name: asset.name || 'print.png',
        type: asset.mimeType || 'image/png',
        size: asset.size ?? null,
      })
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Não foi possível selecionar a imagem.',
        'error',
      )
    }
  }, [showToast])

  /** Colar print direto no campo — atalho mais comum no navegador. */
  const handlePaste = useCallback((event: ClipboardEvent) => {
    const file = Array.from(event.clipboardData?.files || [])
      .find((item) => item.type.startsWith('image/'))
    if (!file) return
    event.preventDefault()
    if (file.size > MAX_IMAGE_BYTES) {
      showToast('A imagem precisa ter no máximo 3 MB.', 'error')
      return
    }
    setAttachment({
      uri: URL.createObjectURL(file),
      name: file.name || 'print.png',
      type: file.type,
      size: file.size,
    })
  }, [showToast])

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible || !selectedId) return
    const listener = (event: Event) => handlePaste(event as ClipboardEvent)
    window.addEventListener('paste', listener)
    return () => window.removeEventListener('paste', listener)
  }, [visible, selectedId, handlePaste])

  const submitReply = useCallback(async () => {
    if (!selected || sending) return
    const message = reply.trim()
    if (!message && !attachment) return
    setSending(true)
    try {
      if (isTeamView) {
        await replyAdminSupportTicket(selected.scrumhubTicketId, message, attachment)
      } else {
        await commentSupportTicket(selected.scrumhubTicketId, message, attachment)
      }
      setReply('')
      setAttachment(null)
      await loadDetail(selected.scrumhubTicketId, true)
      showToast(
        isTeamView ? 'Resposta enviada ao solicitante.' : 'Resposta enviada para a equipe.',
        'success',
      )
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Não foi possível enviar a resposta.',
        'error',
      )
    } finally {
      if (mountedRef.current) setSending(false)
    }
  }, [selected, reply, attachment, sending, isTeamView, loadDetail, showToast])

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
            {isTeamView
              ? 'Assim que alguém abrir um chamado, ele aparece aqui para a equipe responder.'
              : 'Quando você abrir um chamado, ele aparece aqui com as respostas da equipe.'}
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

                {isTeamView ? (
                  <Text style={styles.cardRequester} numberOfLines={1}>
                    {(ticket as { solicitanteNome?: string | null }).solicitanteNome
                      || (ticket as { solicitanteEmail?: string | null }).solicitanteEmail
                      || 'Solicitante não identificado'}
                  </Text>
                ) : null}

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
            // Na visão da equipe os lados se invertem: quem responde somos nós.
            const mine = isTeamView ? !item.external : item.external
            const author = mine
              ? (isTeamView ? 'Você (equipe)' : 'Você')
              : item.authorName || (isTeamView ? 'Solicitante' : 'Equipe FocoMEI')
            return (
              <View
                key={item.id}
                style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTeam]}
              >
                {!mine ? (
                  <View style={styles.avatar}>
                    <Ionicons
                      name={isTeamView ? 'person-outline' : 'headset-outline'}
                      size={14}
                      color={tokens.accent}
                    />
                  </View>
                ) : null}
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTeam]}>
                  <Text style={[styles.bubbleAuthor, mine && styles.bubbleAuthorMine]}>
                    {author}
                  </Text>
                  {item.text ? (
                    <SupportRichText
                      value={item.text}
                      style={[styles.bubbleText, mine && styles.bubbleTextMine] as never}
                      linkColor={mine ? '#fff' : tokens.accent}
                      codeColor={mine ? '#fff' : theme.textSecondary}
                    />
                  ) : null}
                  {item.imageUrl ? (
                    <Pressable
                      onPress={() => setPreview(item.imageUrl as string)}
                      accessibilityRole="imagebutton"
                      accessibilityLabel="Ampliar imagem da mensagem"
                      style={styles.bubbleImageWrap}
                    >
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={styles.bubbleImage}
                        resizeMode="cover"
                      />
                    </Pressable>
                  ) : null}
                  {(item.attachments || []).map((file) => (
                    <View key={file.url} style={styles.attachmentChip}>
                      <Ionicons
                        name="document-attach-outline"
                        size={13}
                        color={mine ? '#fff' : theme.textSecondary}
                      />
                      <Text
                        style={[styles.attachmentName, mine && styles.bubbleTextMine]}
                        numberOfLines={1}
                      >
                        {file.name}
                      </Text>
                    </View>
                  ))}
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

        {selected?.concluido && !isTeamView ? (
          <View style={[styles.composerWrap, styles.composer]}>
            <View style={styles.completedBar}>
              <Ionicons name="checkmark-circle" size={18} color={theme.success} />
              <Text style={styles.completedText}>Ticket concluído pela equipe</Text>
            </View>
          </View>
        ) : (
          <View style={styles.composerWrap}>
            {attachment ? (
              <View style={styles.attachPreview}>
                <Image source={{ uri: attachment.uri }} style={styles.attachThumb} />
                <Text style={styles.attachLabel} numberOfLines={1}>{attachment.name}</Text>
                <Pressable
                  onPress={() => setAttachment(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Remover imagem anexada"
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={20} color={theme.error} />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.composer}>
              <Pressable
                onPress={() => void pickImage()}
                accessibilityRole="button"
                accessibilityLabel="Anexar imagem"
                style={({ pressed }) => [styles.attachButton, pressed && styles.iconPressed]}
              >
                <Ionicons name="image-outline" size={20} color={tokens.accent} />
              </Pressable>
              <TextInput
                value={reply}
                onChangeText={setReply}
                placeholder={isTeamView
                  ? 'Responder como equipe FocoMEI…'
                  : 'Escreva sua resposta para a equipe…'}
                placeholderTextColor={theme.placeholder}
                multiline
                maxLength={5000}
                style={styles.input}
                accessibilityLabel="Resposta do chamado"
              />
              <Pressable
                onPress={() => void submitReply()}
                disabled={(!reply.trim() && !attachment) || sending}
                accessibilityRole="button"
                accessibilityLabel="Enviar resposta"
                style={[
                  styles.sendButton,
                  ((!reply.trim() && !attachment) || sending) && styles.disabled,
                ]}
              >
                {sending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="arrow-up" size={20} color="#fff" />}
              </Pressable>
            </View>

            <Text style={styles.composerHint}>
              {Platform.OS === 'web'
                ? 'Use **negrito**, *itálico*, `código` e cole prints com Ctrl+V.'
                : 'Use **negrito**, *itálico* e `código` para destacar.'}
            </Text>
          </View>
        )}
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
                  : (isTeamView ? 'Todos os chamados' : 'Meus chamados')}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {selected
                  ? (isTeamView && requesterLabel ? `${selected.nome} · ${requesterLabel}` : selected.nome)
                  : (isTeamView
                    ? 'Responda os solicitantes como equipe FocoMEI'
                    : 'Acompanhe e responda a equipe FocoMEI')}
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

          {isSuperAdmin && !selected ? (
            <View style={styles.tabBar}>
              {([
                { key: 'mine' as Scope, label: 'Meus chamados' },
                { key: 'all' as Scope, label: 'Todos os chamados' },
              ]).map((tab) => {
                const active = scope === tab.key
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => changeScope(tab.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={[styles.tab, active && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>
                      {tab.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          ) : null}

          {selected ? renderConversation() : renderList()}
        </SafeAreaView>

        {preview ? (
          <Pressable
            style={styles.previewBackdrop}
            onPress={() => setPreview(null)}
            accessibilityRole="button"
            accessibilityLabel="Fechar imagem"
          >
            <Image source={{ uri: preview }} style={styles.previewImage} resizeMode="contain" />
          </Pressable>
        ) : null}
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
    cardRequester: { fontSize: 12, color: theme.textSecondary },

    tabBar: {
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: mfSpacing.md,
      paddingTop: mfSpacing.sm,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 9,
      borderRadius: mfRadius.pill,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: inset,
    },
    tabActive: { borderColor: tokens.accent, backgroundColor: tokens.accentSoft },
    tabText: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
    tabTextActive: { color: tokens.accent },
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
    bubbleImageWrap: {
      marginTop: 8,
      borderRadius: mfRadius.sm,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: tokens.insetBorder,
    },
    bubbleImage: { width: '100%', height: 170, backgroundColor: inset },
    attachmentChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
    },
    attachmentName: { flex: 1, fontSize: 12, color: theme.textSecondary },

    previewBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(2, 10, 24, 0.9)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: mfSpacing.lg,
    },
    previewImage: { width: '100%', height: '100%' },

    composerWrap: {
      borderTopWidth: 1,
      borderTopColor: tokens.divider,
      backgroundColor: isDarkMode ? 'rgba(7, 24, 48, 0.6)' : '#FFFFFF',
      paddingBottom: mfSpacing.sm,
    },
    attachPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: mfSpacing.md,
      marginTop: mfSpacing.sm,
      padding: 8,
      borderRadius: mfRadius.md,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: inset,
    },
    attachThumb: { width: 40, height: 40, borderRadius: mfRadius.sm },
    attachLabel: { flex: 1, fontSize: 12, color: theme.textSecondary },
    attachButton: {
      width: 44,
      height: 44,
      borderRadius: mfRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: inset,
    },
    composerHint: {
      fontSize: 11,
      color: theme.textTertiary,
      paddingHorizontal: mfSpacing.md,
      paddingTop: 2,
    },

    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 9,
      padding: mfSpacing.md,
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
