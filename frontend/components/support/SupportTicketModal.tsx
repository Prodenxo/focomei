import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MfScrollView } from '@/components/ui/MfScrollView'
import { MfSegmented } from '@/components/ui/MfSegmented'
import { useMfTheme } from '@/components/ui/useMfTheme'
import { getSiteTokens, mfSiteInput, mfSitePrimaryBtn, siteFieldLabelStyle } from '@/lib/siteDesign'
import { mfTechPanelChrome } from '@/lib/techDesign'
import { mfRadius, mfSpacing } from '@/lib/theme'
import {
  createSupportTicket,
  fetchSupportTicketFormConfig,
  type SupportTicketAttachment,
  type SupportTicketPriority,
} from '@/services/supportService'
import { useAppToastStore } from '@/store/appToastStore'

export type SupportTicketModalProps = {
  visible: boolean
  onClose: () => void
  userEmail?: string | null
  userName?: string | null
  userPhone?: string | null
}

const MODAL_MAX_WIDTH = 560

const PRIORITY_OPTIONS: Array<{ key: SupportTicketPriority; label: string }> = [
  { key: 'baixa', label: 'Baixa' },
  { key: 'media', label: 'Média' },
  { key: 'alta', label: 'Alta' },
  { key: 'critica', label: 'Crítica' },
]

function defaultPrazoIso (daysAhead = 7): string {
  const date = new Date()
  date.setDate(date.getDate() + daysAhead)
  return date.toISOString().slice(0, 10)
}

function SupportTicketDateField ({
  value,
  onChange,
  isDarkMode,
  textColor,
  mutedColor,
}: {
  value: string
  onChange: (value: string) => void
  isDarkMode: boolean
  textColor: string
  mutedColor: string
}) {
  if (Platform.OS === 'web') {
    return (
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: '100%',
          minHeight: 44,
          padding: '10px 12px',
          fontSize: 14,
          borderRadius: 12,
          border: `1px solid ${isDarkMode ? 'rgba(148, 163, 184, 0.25)' : 'rgba(15, 23, 42, 0.12)'}`,
          backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.35)' : '#fff',
          color: textColor,
        }}
      />
    )
  }

  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="AAAA-MM-DD"
      placeholderTextColor={mutedColor}
      autoCapitalize="none"
      style={[
        styles.input,
        mfSiteInput(isDarkMode),
        { color: textColor },
      ]}
    />
  )
}
const ALLOWED_DOC_TYPES = Platform.OS === 'web'
  ? '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp'
  : [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/rtf',
    'text/rtf',
  ]

function formatFileSize (bytes?: number | null): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function SupportTicketModal ({
  visible,
  onClose,
  userEmail,
  userName,
  userPhone,
}: SupportTicketModalProps) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { theme, isDarkMode } = useMfTheme()
  const siteTokens = getSiteTokens(isDarkMode)
  const showToast = useAppToastStore((s) => s.show)
  const panelChrome = useMemo(() => mfTechPanelChrome(isDarkMode, 'surface'), [isDarkMode])
  const dialogWidth = Math.min(width - mfSpacing.lg * 2, MODAL_MAX_WIDTH)
  const primaryBtn = useMemo(() => mfSitePrimaryBtn(isDarkMode), [isDarkMode])

  const [loadingConfig, setLoadingConfig] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [projetoNome, setProjetoNome] = useState('Foco MEI')

  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [prioridade, setPrioridade] = useState<SupportTicketPriority>('media')
  const [prazo, setPrazo] = useState(defaultPrazoIso())
  const [nomeSolicitante, setNomeSolicitante] = useState('')
  const [emailSolicitante, setEmailSolicitante] = useState('')
  const [contatoSolicitante, setContatoSolicitante] = useState('')
  const [anexos, setAnexos] = useState<SupportTicketAttachment[]>([])

  const resetForm = useCallback(() => {
    setNome('')
    setDescricao('')
    setPrioridade('media')
    setPrazo(defaultPrazoIso())
    setNomeSolicitante(userName?.trim() || '')
    setEmailSolicitante(userEmail?.trim() || '')
    setContatoSolicitante(userPhone?.trim() || '')
    setAnexos([])
  }, [userEmail, userName, userPhone])

  useEffect(() => {
    if (!visible) return
    resetForm()
    setLoadingConfig(true)
    void fetchSupportTicketFormConfig()
      .then((config) => {
        const label = config.projeto?.nome || config.projeto?.empresa_nome
        if (label) setProjetoNome(label)
      })
      .catch(() => {
        /* mantém label padrão */
      })
      .finally(() => setLoadingConfig(false))
  }, [visible, resetForm])

  const handlePickAttachments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ALLOWED_DOC_TYPES,
        copyToCacheDirectory: true,
        multiple: true,
      })
      if (result.canceled) return

      const picked = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name || 'anexo',
        type: asset.mimeType || 'application/octet-stream',
        size: asset.size ?? null,
      }))

      setAnexos((prev) => {
        const names = new Set(prev.map((f) => f.name))
        return [...prev, ...picked.filter((f) => !names.has(f.name))]
      })
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível selecionar o arquivo.')
    }
  }

  const handleRemoveAttachment = (name: string) => {
    setAnexos((prev) => prev.filter((file) => file.name !== name))
  }

  const handleSubmit = async () => {
    const assunto = nome.trim()
    if (!assunto) {
      Alert.alert('Atenção', 'Informe o assunto do chamado.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo.trim())) {
      Alert.alert('Atenção', 'Informe o prazo no formato AAAA-MM-DD.')
      return
    }

    setSubmitting(true)
    try {
      await createSupportTicket({
        nome: assunto,
        descricao: descricao.trim() || undefined,
        prioridade,
        prazo: prazo.trim(),
        nome_solicitante: nomeSolicitante.trim() || undefined,
        email_solicitante: emailSolicitante.trim() || undefined,
        contato_solicitante: contatoSolicitante.trim() || undefined,
        anexos,
      })
      showToast('Chamado criado com sucesso!', 'success')
      onClose()
    } catch (error) {
      Alert.alert(
        'Erro',
        error instanceof Error ? error.message : 'Não foi possível criar o chamado.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={[styles.title, { color: siteTokens.textPrimary }]}>Abrir chamado</Text>
        <Text style={[styles.subtitle, { color: siteTokens.textSecondary }]}>
          {projetoNome} — descreva o problema e anexe arquivos se precisar.
        </Text>
      </View>
      <Pressable
        onPress={onClose}
        disabled={submitting}
        style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Fechar formulário de suporte"
      >
        <Ionicons name="close" size={22} color={theme.textSecondary} />
      </Pressable>
    </View>
  )

  const formBody = (
    <MfScrollView style={styles.formScroll} contentContainerStyle={styles.formContent}>
      {loadingConfig ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={siteTokens.neon} />
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={[siteFieldLabelStyle, styles.label, { color: siteTokens.textSecondary }]}>
          Assunto *
        </Text>
        <TextInput
          value={nome}
          onChangeText={setNome}
          placeholder="Ex.: erro ao emitir nota fiscal"
          placeholderTextColor={siteTokens.textMuted}
          style={[styles.input, mfSiteInput(isDarkMode), { color: siteTokens.textPrimary }]}
        />
      </View>

      <View style={styles.field}>
        <Text style={[siteFieldLabelStyle, styles.label, { color: siteTokens.textSecondary }]}>
          Prioridade *
        </Text>
        <MfSegmented
          options={PRIORITY_OPTIONS}
          value={prioridade}
          onChange={setPrioridade}
        />
      </View>

      <View style={styles.field}>
        <Text style={[siteFieldLabelStyle, styles.label, { color: siteTokens.textSecondary }]}>
          Prazo *
        </Text>
        <SupportTicketDateField
          value={prazo}
          onChange={setPrazo}
          isDarkMode={isDarkMode}
          textColor={siteTokens.textPrimary}
          mutedColor={siteTokens.textMuted}
        />
        <Text style={[styles.fieldHint, { color: siteTokens.textMuted }]}>
          Se precisar, você ajusta depois no ScrumHub.
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={[siteFieldLabelStyle, styles.label, { color: siteTokens.textSecondary }]}>
          Descrição
        </Text>
        <TextInput
          value={descricao}
          onChangeText={setDescricao}
          placeholder="Conte o que aconteceu, passos para reproduzir, mensagens de erro…"
          placeholderTextColor={siteTokens.textMuted}
          multiline
          textAlignVertical="top"
          style={[
            styles.input,
            styles.textarea,
            mfSiteInput(isDarkMode),
            { color: siteTokens.textPrimary },
          ]}
        />
      </View>

      <View style={styles.field}>
        <Text style={[siteFieldLabelStyle, styles.label, { color: siteTokens.textSecondary }]}>
          Seu nome
        </Text>
        <TextInput
          value={nomeSolicitante}
          onChangeText={setNomeSolicitante}
          placeholder="Como podemos te chamar"
          placeholderTextColor={siteTokens.textMuted}
          style={[styles.input, mfSiteInput(isDarkMode), { color: siteTokens.textPrimary }]}
        />
      </View>

      <View style={styles.field}>
        <Text style={[siteFieldLabelStyle, styles.label, { color: siteTokens.textSecondary }]}>
          E-mail
        </Text>
        <TextInput
          value={emailSolicitante}
          onChangeText={setEmailSolicitante}
          placeholder="seu@email.com"
          placeholderTextColor={siteTokens.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          style={[styles.input, mfSiteInput(isDarkMode), { color: siteTokens.textPrimary }]}
        />
      </View>

      <View style={styles.field}>
        <Text style={[siteFieldLabelStyle, styles.label, { color: siteTokens.textSecondary }]}>
          WhatsApp / telefone
        </Text>
        <TextInput
          value={contatoSolicitante}
          onChangeText={setContatoSolicitante}
          placeholder="(21) 99999-9999"
          placeholderTextColor={siteTokens.textMuted}
          keyboardType="phone-pad"
          style={[styles.input, mfSiteInput(isDarkMode), { color: siteTokens.textPrimary }]}
        />
      </View>

      <View style={styles.field}>
        <Text style={[siteFieldLabelStyle, styles.label, { color: siteTokens.textSecondary }]}>
          Anexos (PDFs, documentos, etc.)
        </Text>
        <Pressable
          onPress={() => void handlePickAttachments()}
          style={({ pressed }) => [
            styles.dropzone,
            { borderColor: siteTokens.neonBorder, backgroundColor: siteTokens.neonDim },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Selecionar arquivos para anexar"
        >
          <Ionicons name="cloud-upload-outline" size={22} color={siteTokens.neon} />
          <Text style={[styles.dropzoneText, { color: siteTokens.textSecondary }]}>
            Toque para selecionar arquivos
          </Text>
          <Text style={[styles.dropzoneHint, { color: siteTokens.textMuted }]}>
            Máx. 50MB por arquivo. PDF, Word, Excel, PowerPoint, TXT, CSV, RTF ou OpenDocument.
          </Text>
        </Pressable>

        {anexos.length > 0 ? (
          <View style={styles.attachList}>
            <Text style={[styles.attachCount, { color: siteTokens.textSecondary }]}>
              {anexos.length} arquivo(s) selecionado(s)
            </Text>
            {anexos.map((file) => (
              <View
                key={file.name}
                style={[styles.attachRow, { borderColor: siteTokens.divider }]}
              >
                <View style={styles.attachCopy}>
                  <Text style={[styles.attachName, { color: siteTokens.textPrimary }]} numberOfLines={1}>
                    {file.name}
                  </Text>
                  {file.size ? (
                    <Text style={[styles.attachSize, { color: siteTokens.textMuted }]}>
                      {formatFileSize(file.size)}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => handleRemoveAttachment(file.name)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remover ${file.name}`}
                  style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </MfScrollView>
  )

  const footer = (
    <View style={[styles.footer, { borderTopColor: siteTokens.divider }]}>
      <Pressable
        onPress={onClose}
        disabled={submitting}
        style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={[styles.secondaryBtnText, { color: siteTokens.textSecondary }]}>Cancelar</Text>
      </Pressable>
      <Pressable
        onPress={() => void handleSubmit()}
        disabled={submitting}
        style={({ pressed }) => [
          styles.primaryBtn,
          primaryBtn,
          (submitting || pressed) && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Criar chamado de suporte"
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Criar chamado</Text>
        )}
      </Pressable>
    </View>
  )

  if (Platform.OS === 'web') {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.dialogOverlay}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
          <View style={[styles.dialogShell, { width: dialogWidth }]} pointerEvents="box-none">
            <View style={[styles.dialogCard, panelChrome]} pointerEvents="auto">
              {header}
              {formBody}
              {footer}
            </View>
          </View>
        </View>
      </Modal>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.nativeRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={[styles.nativeCard, panelChrome]}>
          {header}
          {formBody}
          {footer}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  dialogOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: mfSpacing.lg,
    paddingVertical: mfSpacing.xl,
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10000,
        } as object)
      : {}),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  dialogShell: {
    maxHeight: '92vh' as unknown as number,
    zIndex: 1,
  },
  dialogCard: {
    width: '100%',
    maxHeight: '92vh' as unknown as number,
    overflow: 'hidden',
    borderRadius: mfRadius.xl,
    flexDirection: 'column',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 24px 48px rgba(0, 0, 0, 0.35)' } as object)
      : {}),
  },
  nativeRoot: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingHorizontal: mfSpacing.md,
  },
  nativeCard: {
    flex: 1,
    borderRadius: mfRadius.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: mfSpacing.md,
    paddingHorizontal: mfSpacing.lg,
    paddingTop: mfSpacing.lg,
    paddingBottom: mfSpacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: mfRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formScroll: {
    flex: 1,
    ...(Platform.OS === 'web' ? ({ maxHeight: 'min(68vh, 640px)' } as object) : {}),
  },
  formContent: {
    paddingHorizontal: mfSpacing.lg,
    paddingBottom: mfSpacing.lg,
    gap: mfSpacing.md,
  },
  loadingWrap: {
    paddingVertical: mfSpacing.sm,
    alignItems: 'center',
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 12,
  },
  fieldHint: {
    fontSize: 11,
    lineHeight: 15,
  },
  input: {
    minHeight: 44,
    paddingHorizontal: mfSpacing.md,
    paddingVertical: 10,
    fontSize: 14,
  },
  textarea: {
    minHeight: 112,
    paddingTop: 12,
  },
  dropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: mfRadius.lg,
    padding: mfSpacing.lg,
    alignItems: 'center',
    gap: 6,
  },
  dropzoneText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dropzoneHint: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  attachList: {
    gap: mfSpacing.sm,
    marginTop: mfSpacing.sm,
  },
  attachCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  attachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: mfSpacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: mfRadius.md,
    paddingHorizontal: mfSpacing.md,
    paddingVertical: 10,
  },
  attachCopy: {
    flex: 1,
    gap: 2,
  },
  attachName: {
    fontSize: 13,
    fontWeight: '500',
  },
  attachSize: {
    fontSize: 11,
  },
  removeBtn: {
    padding: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: mfSpacing.sm,
    paddingHorizontal: mfSpacing.lg,
    paddingVertical: mfSpacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  secondaryBtn: {
    paddingHorizontal: mfSpacing.md,
    paddingVertical: 10,
    borderRadius: mfRadius.lg,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  primaryBtn: {
    minWidth: 140,
    minHeight: 42,
    borderRadius: mfRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: mfSpacing.lg,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.78,
  },
})
