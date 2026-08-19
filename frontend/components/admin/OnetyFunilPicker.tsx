import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Theme } from '../../lib/theme'
import { mfSpacing } from '../../lib/theme'
import {
  listOnetyCrmFunis,
  type OnetyCrmFunilOption,
} from '../../services/adminBillingService'

type Props = {
  theme: Theme
  value: number | null
  onChange: (funilId: number | null) => void
  compact?: boolean
}

export function OnetyFunilPicker({ theme, value, onChange, compact = false }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [funis, setFunis] = useState<OnetyCrmFunilOption[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const styles = createStyles(theme, compact)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    void listOnetyCrmFunis()
      .then((data) => {
        if (cancelled) return
        setFunis(data.funis || [])
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Erro ao carregar funis')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selected = funis.find((f) => f.id === value)
  const readyFunis = funis.filter((f) => f.ready)

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Funil comercial (CRM Onety)</Text>
      <TouchableOpacity
        style={styles.field}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Selecionar funil comercial Onety"
      >
        <Ionicons name="funnel-outline" size={16} color={theme.primary} />
        <Text style={[styles.fieldText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected?.name || (readyFunis.length ? 'Selecione o funil' : 'Carregando funis…')}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color={theme.textSecondary} />
        ) : (
          <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
        )}
      </TouchableOpacity>
      {loadError ? <Text style={styles.hintError}>{loadError}</Text> : null}
      {!loadError && readyFunis.length === 0 && !loading ? (
        <Text style={styles.hint}>
          Nenhum funil pronto — configure fases Lead/Proposta no backend.
        </Text>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Funil comercial</Text>
              <TouchableOpacity onPress={() => setOpen(false)} accessibilityLabel="Fechar">
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetList}>
              {funis.map((funil) => {
                const disabled = !funil.ready
                const active = funil.id === value
                return (
                  <TouchableOpacity
                    key={funil.id}
                    style={[styles.option, active && styles.optionActive, disabled && styles.optionDisabled]}
                    disabled={disabled}
                    onPress={() => {
                      onChange(funil.id)
                      setOpen(false)
                    }}
                    accessibilityRole="button"
                  >
                    <View style={styles.optionTextCol}>
                      <Text style={[styles.optionTitle, disabled && styles.optionTitleDisabled]}>
                        {funil.name}
                      </Text>
                      <Text style={styles.optionMeta}>
                        {disabled ? 'Fases não configuradas' : `ID ${funil.id}`}
                      </Text>
                    </View>
                    {active ? <Ionicons name="checkmark-circle" size={20} color={theme.primary} /> : null}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

function createStyles(theme: Theme, compact: boolean) {
  return StyleSheet.create({
    wrap: {
      gap: mfSpacing.xs,
    },
    label: {
      fontSize: compact ? 12 : 13,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      paddingHorizontal: mfSpacing.md,
      paddingVertical: compact ? mfSpacing.sm : mfSpacing.md,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    fieldText: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
    },
    placeholder: {
      color: theme.textSecondary,
    },
    hint: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    hintError: {
      fontSize: 12,
      color: theme.error,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      padding: mfSpacing.lg,
    },
    sheet: {
      maxHeight: '70%',
      backgroundColor: theme.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: mfSpacing.lg,
      paddingVertical: mfSpacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    sheetTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    sheetList: {
      padding: mfSpacing.sm,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      paddingHorizontal: mfSpacing.md,
      paddingVertical: mfSpacing.md,
      borderRadius: 10,
    },
    optionActive: {
      backgroundColor: theme.surface,
    },
    optionDisabled: {
      opacity: 0.45,
    },
    optionTextCol: {
      flex: 1,
      gap: 2,
    },
    optionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    optionTitleDisabled: {
      color: theme.textSecondary,
    },
    optionMeta: {
      fontSize: 12,
      color: theme.textSecondary,
    },
  })
}
