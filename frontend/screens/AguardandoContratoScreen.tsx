import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { Ionicons } from '@expo/vector-icons'
import { AppBrandLogo } from '@/components/shell/AppBrandLogo'
import { MfScrollView } from '@/components/ui/MfScrollView'
import { brandColors } from '@/lib/brandTokens'
import { fetchMeiBillingGateStatus } from '@/lib/meiBillingGate'
import {
  hasMeiContractPendingSession,
  readMeiContractPendingSession,
  clearMeiContractPendingSession,
  stashMeiContractPendingSession,
} from '@/lib/meiContractPendingSession'
import { refreshMeiContractSignature } from '@/services/billingService'
import { useAppToastStore } from '@/store/appToastStore'
import { useAuthStore } from '@/store/authStore'

const NAVY = brandColors.primary
const GREEN = brandColors.secondary
const PAGE_BG = '#EEF2F7'

export default function AguardandoContratoScreen () {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const showToast = useAppToastStore((s) => s.show)
  const signOut = useAuthStore((s) => s.signOut)
  const userEmail = useAuthStore((s) => s.user?.email?.trim() || '')

  const [loading, setLoading] = useState(true)
  const [refreshingLink, setRefreshingLink] = useState(false)
  const [signingUrl, setSigningUrl] = useState<string | null>(null)
  const [contratoId, setContratoId] = useState<number | null>(null)

  const persistSigningUrl = useCallback(async (url: string | null | undefined, id?: number | null) => {
    if (!url) return
    setSigningUrl(url)
    const pending = await readMeiContractPendingSession()
    await stashMeiContractPendingSession({
      lineId: pending?.lineId,
      signingUrl: url,
      contratoOnetyId: id ?? pending?.contratoOnetyId ?? contratoId,
    })
  }, [contratoId])

  const isWide = width >= 720
  const styles = useMemo(() => createStyles(isWide), [isWide])

  const loadStatus = useCallback(async () => {
    const pending = await readMeiContractPendingSession()
    if (pending?.signingUrl) setSigningUrl(pending.signingUrl)
    if (pending?.contratoOnetyId) setContratoId(pending.contratoOnetyId)

    const status = await fetchMeiBillingGateStatus()
    if (status.phase === 'ok' || status.hasActiveSubscription) {
      await clearMeiContractPendingSession()
      router.replace('/(app)/' as never)
      return false
    }
    if (status.phase === 'planos' && !hasMeiContractPendingSession(pending)) {
      router.replace('/(app)/planos' as never)
      return false
    }
    setSigningUrl(status.contract?.signingUrl ?? pending?.signingUrl ?? null)
    setContratoId(status.contract?.contratoOnetyId ?? pending?.contratoOnetyId ?? null)
    if (status.contract?.signingUrl) {
      await stashMeiContractPendingSession({
        lineId: status.contract?.lineId ?? pending?.lineId,
        signingUrl: status.contract.signingUrl,
        contratoOnetyId: status.contract?.contratoOnetyId ?? pending?.contratoOnetyId ?? null,
      })
    }
    return true
  }, [router])

  const checkSignature = useCallback(async () => {
    try {
      const result = await refreshMeiContractSignature()
      if (result.signingUrl) await persistSigningUrl(result.signingUrl, result.contratoOnetyId ?? null)
      if (result.contratoOnetyId) setContratoId(result.contratoOnetyId)
      if (result.activated) {
        await clearMeiContractPendingSession()
        showToast('Contrato assinado! Liberando sua conta…', 'success')
        router.replace('/(app)/' as never)
      }
    } catch {
      /* polling silencioso — próxima tentativa em 15s */
    }
  }, [router, showToast, persistSigningUrl])

  const handleRefreshLink = useCallback(async () => {
    setRefreshingLink(true)
    try {
      const result = await refreshMeiContractSignature()
      if (result.signingUrl) {
        await persistSigningUrl(result.signingUrl, result.contratoOnetyId ?? null)
        if (result.contratoOnetyId) setContratoId(result.contratoOnetyId)
        showToast('Link de assinatura encontrado!', 'success')
        return
      }
      if (result.pollError === 'webhook_url_not_configured') {
        showToast('Robô de contrato não configurado no servidor. Avise o suporte FocoMEI.', 'error')
        return
      }
      if (result.reason === 'missing_contrato_id') {
        showToast('Contrato ainda sendo registrado. Verifique o WhatsApp ou tente em instantes.', 'info')
        return
      }
      showToast('Link ainda não disponível — verifique o WhatsApp ou tente de novo em instantes.', 'info')
    } catch {
      showToast('Não foi possível buscar o link agora. Tente novamente.', 'error')
    } finally {
      setRefreshingLink(false)
    }
  }, [persistSigningUrl, showToast])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const stay = await loadStatus()
        if (stay) await checkSignature()
      } finally {
        setLoading(false)
      }
    })()
  }, [loadStatus, checkSignature])

  useEffect(() => {
    const intervalMs = signingUrl ? 15000 : 4000
    const interval = setInterval(() => {
      void checkSignature()
    }, intervalMs)
    return () => clearInterval(interval)
  }, [checkSignature, signingUrl])

  const handleCopy = async () => {
    if (!signingUrl) {
      showToast('Link ainda não disponível — aguarde ou verifique o WhatsApp.', 'info')
      return
    }
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(signingUrl)
    } else {
      await Clipboard.setStringAsync(signingUrl)
    }
    showToast('Link copiado!', 'success')
  }

  const handleOpen = async () => {
    if (!signingUrl) {
      showToast('Link ainda não disponível.', 'info')
      return
    }
    await Linking.openURL(signingUrl)
  }

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={GREEN} />
        <Text style={styles.bootHint}>Carregando…</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <MfScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} hideLegalFooter>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <AppBrandLogo variant="wordmark" onDarkBackground height={36} />
            <Pressable
              onPress={() => void signOut().then(() => router.replace('/(auth)/login' as never))}
              accessibilityRole="button"
              accessibilityLabel="Sair da conta"
              style={styles.signOutChip}
            >
              <Ionicons name="log-out-outline" size={16} color="rgba(255,255,255,0.85)" />
              <Text style={styles.signOutText}>Sair</Text>
            </Pressable>
          </View>
          <Text style={styles.heroTitle}>Assine o contrato</Text>
          <Text style={styles.heroSub}>
            Sua conta será liberada após a assinatura do contrato pelo responsável da empresa.
          </Text>
          {userEmail ? <Text style={styles.heroEmail}>Logado como {userEmail}</Text> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="logo-whatsapp" size={28} color={GREEN} />
          </View>
          <Text style={styles.cardTitle}>Verifique seu WhatsApp</Text>
          <Text style={styles.cardBody}>
            Enviamos o link de assinatura digital (Autentique) para o telefone cadastrado.
            Se não recebeu em alguns minutos, copie o link abaixo.
          </Text>

          {contratoId ? (
            <Text style={styles.meta}>Contrato #{contratoId}</Text>
          ) : null}

          <View style={styles.linkBox}>
            <Text style={styles.linkText} selectable numberOfLines={3}>
              {signingUrl || 'Gerando link de assinatura…'}
            </Text>
          </View>

          <Pressable
            style={[styles.btn, styles.btnRefresh, refreshingLink && styles.btnDisabled]}
            onPress={() => void handleRefreshLink()}
            disabled={refreshingLink}
            accessibilityRole="button"
            accessibilityLabel="Atualizar link de assinatura"
          >
            {refreshingLink ? (
              <ActivityIndicator size="small" color={NAVY} />
            ) : (
              <Ionicons name="refresh-outline" size={18} color={NAVY} />
            )}
            <Text style={styles.btnSecondaryText}>
              {signingUrl ? 'Atualizar link' : 'Buscar link agora'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnPrimary, !signingUrl && styles.btnDisabled]}
            onPress={() => void handleCopy()}
            disabled={!signingUrl}
            accessibilityRole="button"
            accessibilityLabel="Copiar link de assinatura"
          >
            <Ionicons name="copy-outline" size={18} color="#fff" />
            <Text style={styles.btnPrimaryText}>Copiar link</Text>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnSecondary, !signingUrl && styles.btnDisabled]}
            onPress={() => void handleOpen()}
            disabled={!signingUrl}
            accessibilityRole="button"
            accessibilityLabel="Abrir link de assinatura"
          >
            <Ionicons name="open-outline" size={18} color={NAVY} />
            <Text style={styles.btnSecondaryText}>Abrir link de assinatura</Text>
          </Pressable>

          <Text style={styles.autoHint}>
            Assim que você assinar, liberamos sua conta automaticamente.
          </Text>
        </View>
      </MfScrollView>
    </View>
  )
}

function createStyles (isWide: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: PAGE_BG },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 32 },
    centered: { alignItems: 'center', justifyContent: 'center', gap: 12 },
    bootHint: { color: '#64748b', fontSize: 14 },
    hero: {
      backgroundColor: NAVY,
      paddingHorizontal: isWide ? 48 : 24,
      paddingTop: 28,
      paddingBottom: 32,
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    signOutChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    signOutText: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
    heroTitle: { color: '#fff', fontSize: isWide ? 32 : 26, fontWeight: '700' },
    heroSub: { color: 'rgba(255,255,255,0.82)', fontSize: 15, marginTop: 8, lineHeight: 22 },
    heroEmail: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 12 },
    card: {
      marginHorizontal: isWide ? 48 : 20,
      marginTop: -16,
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 24,
      shadowColor: '#0f172a',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: 'rgba(34,197,94,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    cardTitle: { fontSize: 20, fontWeight: '700', color: NAVY },
    cardBody: { fontSize: 15, color: '#475569', lineHeight: 22, marginTop: 8 },
    meta: { fontSize: 13, color: '#94a3b8', marginTop: 12 },
    linkBox: {
      marginTop: 16,
      padding: 12,
      borderRadius: 10,
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0',
    },
    linkText: { fontSize: 13, color: '#334155' },
    btn: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
    },
    btnPrimary: { backgroundColor: GREEN },
    btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    btnSecondary: { backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe' },
    btnRefresh: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
    btnSecondaryText: { color: NAVY, fontWeight: '600', fontSize: 15 },
    btnDisabled: { opacity: 0.5 },
    autoHint: {
      marginTop: 20,
      fontSize: 13,
      color: '#64748b',
      textAlign: 'center',
      lineHeight: 20,
    },
  })
}
