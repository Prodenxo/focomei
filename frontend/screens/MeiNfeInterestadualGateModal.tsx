import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import {
  acceptNfeInterestadualConsent,
  getNfeInterestadualStatus,
  type NfeInterestadualStatus,
} from '../services/meiNotasService'
import { normalizeUf } from '../lib/nfeInterestadual'
import type { Theme } from '../lib/theme'

type Props = {
  visible: boolean
  theme: Theme
  ufDestino: string
  onCancel: () => void
  onReady: () => void
  /**
   * `embedded` — overlay dentro do modal Emitir nota (evita 2º Modal na web).
   * `modal` — Modal RN standalone (fallback).
   */
  presentation?: 'embedded' | 'modal'
  confirmLabel?: string
}

/**
 * Gate MEI interestadual: só o aceite do termo.
 * DAS é fixo — não pedimos alíquota ICMS na nota (CSOSN 102 + CFOP 6xxx).
 */
export function MeiNfeInterestadualGateModal({
  visible,
  theme,
  ufDestino,
  onCancel,
  onReady,
  presentation = 'modal',
  confirmLabel = 'Confirmar e continuar',
}: Props) {
  const uf = normalizeUf(ufDestino)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<NfeInterestadualStatus | null>(null)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      setAccepted(false)
      try {
        const data = await getNfeInterestadualStatus()
        if (cancelled) return
        setStatus(data)
        setAccepted(Boolean(data.consentAccepted))
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Não foi possível carregar o aviso interestadual.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [visible, uf])

  const handleConfirm = async () => {
    if (saving) return
    setError(null)
    if (!status?.consentAccepted && !accepted) {
      setError('Marque a declaração para continuar.')
      return
    }

    setSaving(true)
    try {
      if (!status?.consentAccepted) {
        await acceptNfeInterestadualConsent(true)
      }
      onReady()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar o aceite.')
    } finally {
      setSaving(false)
    }
  }

  if (!visible) return null

  const sheet = (
    <View style={styles.backdrop}>
      <View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: theme.text }]}>
            Venda para outro estado ({uf || '—'})
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            No MEI o imposto é o DAS mensal (fixo). Nesta NF-e não destacamos ICMS sobre o valor —
            só ajustamos o CFOP para venda interestadual (6xxx) e mantemos o CSOSN do MEI (ex.: 102).
          </Text>

          {loading ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: 24 }} />
          ) : (
            <>
              <View style={[styles.disclaimer, { backgroundColor: 'rgba(180, 120, 20, 0.12)', borderColor: 'rgba(180, 120, 20, 0.35)' }]}>
                <Text style={[styles.disclaimerText, { color: theme.text }]}>
                  {status?.disclaimer
                    || 'No MEI o imposto é o DAS. A NF-e interestadual não leva ICMS destacado; o FocoMEI só ajusta o CFOP.'}
                </Text>
              </View>

              {!status?.consentAccepted ? (
                <TouchableOpacity
                  style={styles.checkRow}
                  onPress={() => setAccepted((v) => !v)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: accepted }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, { borderColor: theme.border, backgroundColor: accepted ? theme.primary : 'transparent' }]}>
                    {accepted ? <Text style={styles.checkMark}>✓</Text> : null}
                  </View>
                  <Text style={[styles.checkLabel, { color: theme.text }]}>
                    {status?.checkboxText
                      || 'Declaro que entendi: interestadual no MEI = CFOP 6xxx, sem ICMS na nota (DAS).'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.okConsent, { color: theme.textSecondary }]}>
                  Aviso já aceito. Pode continuar a emissão.
                </Text>
              )}
            </>
          )}

          {error ? (
            <Text style={[styles.error, { color: theme.error }]}>{error}</Text>
          ) : null}
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onCancel}
            style={[styles.btn, styles.btnGhost, { borderColor: theme.border }]}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
          >
            <Text style={{ color: theme.text }}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { void handleConfirm() }}
            style={[styles.btn, { backgroundColor: theme.primary }]}
            disabled={loading || saving}
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>{confirmLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )

  if (presentation === 'embedded') {
    return sheet
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      {sheet}
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  content: {
    padding: 20,
    paddingBottom: 12,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  disclaimer: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  disclaimerText: {
    fontSize: 13,
    lineHeight: 18,
  },
  checkRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkMark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  checkLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  okConsent: {
    fontSize: 13,
  },
  error: {
    fontSize: 13,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingTop: 8,
  },
  btn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnGhost: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '700',
  },
})

export default MeiNfeInterestadualGateModal
