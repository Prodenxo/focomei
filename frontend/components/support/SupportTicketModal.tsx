import React, { useMemo } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import { useMfTheme } from '@/components/ui/useMfTheme'
import { buildScrumHubTicketUrl } from '@/lib/supportUrls'
import { getSiteTokens } from '@/lib/siteDesign'
import { mfTechPanelChrome } from '@/lib/techDesign'
import { openLegalUrl } from '@/lib/legalUrls'
import { mfRadius, mfSpacing } from '@/lib/theme'

export type SupportTicketModalProps = {
  visible: boolean
  onClose: () => void
  userEmail?: string | null
  userName?: string | null
}

const MODAL_MAX_WIDTH = 760
const EMBED_MIN_HEIGHT = 560

function ScrumHubTicketFrame ({ url }: { url: string }) {
  if (Platform.OS === 'web') {
    return (
      <iframe
        src={url}
        title="Formulário de suporte Foco MEI"
        style={{
          width: '100%',
          height: '100%',
          minHeight: EMBED_MIN_HEIGHT,
          border: 'none',
          display: 'block',
          backgroundColor: 'transparent',
        }}
      />
    )
  }

  return (
    <WebView
      source={{ uri: url }}
      style={styles.webView}
      startInLoadingState
      setSupportMultipleWindows={false}
      originWhitelist={['https://*']}
    />
  )
}

export function SupportTicketModal ({
  visible,
  onClose,
  userEmail,
  userName,
}: SupportTicketModalProps) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { theme, isDarkMode } = useMfTheme()
  const siteTokens = getSiteTokens(isDarkMode)
  const panelChrome = useMemo(() => mfTechPanelChrome(isDarkMode, 'surface'), [isDarkMode])
  const ticketUrl = useMemo(
    () => buildScrumHubTicketUrl({ email: userEmail, name: userName }),
    [userEmail, userName],
  )
  const isWebDialog = Platform.OS === 'web'
  const dialogWidth = Math.min(width - mfSpacing.lg * 2, MODAL_MAX_WIDTH)

  const handleOpenExternal = () => {
    void openLegalUrl(ticketUrl)
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={[styles.title, { color: siteTokens.textPrimary }]}>Abrir chamado</Text>
        <Text style={[styles.subtitle, { color: siteTokens.textSecondary }]}>
          Descreva o problema e anexe arquivos se precisar.
        </Text>
      </View>
      <Pressable
        onPress={onClose}
        style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Fechar formulário de suporte"
      >
        <Ionicons name="close" size={22} color={theme.textSecondary} />
      </Pressable>
    </View>
  )

  const footer = (
    <View style={styles.footer}>
      <Pressable
        onPress={handleOpenExternal}
        style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Abrir formulário de suporte em nova aba"
      >
        <Ionicons name="open-outline" size={16} color={siteTokens.neon} />
        <Text style={[styles.footerLinkText, { color: siteTokens.neon }]}>
          Abrir em nova aba
        </Text>
      </Pressable>
    </View>
  )

  const embed = (
    <View style={styles.embedWrap}>
      <ScrumHubTicketFrame url={ticketUrl} />
    </View>
  )

  if (isWebDialog) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.dialogOverlay}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
          <View style={[styles.dialogShell, { width: dialogWidth }]} pointerEvents="box-none">
            <View style={[styles.dialogCard, panelChrome]} pointerEvents="auto">
              {header}
              {embed}
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
          {embed}
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
    maxHeight: '90vh' as unknown as number,
    zIndex: 1,
  },
  dialogCard: {
    width: '100%',
    maxHeight: '90vh' as unknown as number,
    overflow: 'hidden',
    borderRadius: mfRadius.xl,
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
  embedWrap: {
    flex: 1,
    minHeight: EMBED_MIN_HEIGHT,
    ...(Platform.OS === 'web'
      ? ({ height: 'min(72vh, 720px)' } as object)
      : {}),
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  footer: {
    paddingHorizontal: mfSpacing.lg,
    paddingVertical: mfSpacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.25)',
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  footerLinkText: {
    fontSize: 13,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.75,
  },
})
