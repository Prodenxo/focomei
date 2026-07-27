import React, { useMemo } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Theme } from '../../lib/theme'
import { mfRadius, mfSpacing } from '../../lib/theme'
import { getTechTokens, mfTechPanelChrome } from '../../lib/techDesign'
import { useMfTheme } from '../../components/ui/useMfTheme'
import { TransactionsPeriodToolbar } from './TransactionsPeriodToolbar'
import { TransactionsFilterPills } from './TransactionsFilterPills'
import type { TransactionDateRange, TransactionPeriodPreset } from '../../lib/transactionPeriodFilter'
import type { ContaFinanceira } from '../../lib/contaFinanceiraTypes'
import type { ContaFilterValue } from '../../lib/contaFinanceiraIntegration'

type PillStyles = React.ComponentProps<typeof TransactionsFilterPills>['styles']

type Props = {
  visible: boolean
  onClose: () => void
  theme: Theme
  pillStyles: PillStyles
  periodPreset: TransactionPeriodPreset
  dateRange: TransactionDateRange
  useCustomRange: boolean
  typeFilter: 'all' | 'entrada' | 'saida'
  statusFilter: 'all' | 'pago' | 'pendente'
  contaFilter: ContaFilterValue
  contasAtivas: ContaFinanceira[]
  onPeriodChange: (p: TransactionPeriodPreset) => void
  onDateRangeChange: (range: TransactionDateRange) => void
  onClearRange: () => void
  onTypeChange: (v: 'all' | 'entrada' | 'saida') => void
  onStatusChange: (v: 'all' | 'pago' | 'pendente') => void
  onContaChange: (v: ContaFilterValue) => void
  onClearAll: () => void
}

export function TransactionsFiltersModal ({
  visible,
  onClose,
  theme,
  pillStyles,
  periodPreset,
  dateRange,
  useCustomRange,
  typeFilter,
  statusFilter,
  contaFilter,
  contasAtivas,
  onPeriodChange,
  onDateRangeChange,
  onClearRange,
  onTypeChange,
  onStatusChange,
  onContaChange,
  onClearAll,
}: Props) {
  const { isDarkMode } = useMfTheme()
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode])
  const panelChrome = useMemo(() => mfTechPanelChrome(isDarkMode, 'surface'), [isDarkMode])
  const styles = useMemo(() => createStyles(theme, tokens), [theme, tokens])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar filtros"
        />
        <View
          style={[styles.sheet, panelChrome]}
          accessibilityViewIsModal
          accessibilityLabel="Filtros de transações"
        >
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleRow}>
              <Ionicons name="options-outline" size={18} color={tokens.accent} />
              <Text style={styles.sheetTitle}>Filtros</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
            >
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            <Text style={[styles.sectionLabel, { color: tokens.accent }]}>Período</Text>
            <TransactionsPeriodToolbar
              theme={theme}
              period={periodPreset}
              dateRange={dateRange}
              useCustomRange={useCustomRange}
              compact
              embedded
              onPeriodChange={onPeriodChange}
              onDateRangeChange={onDateRangeChange}
              onClearRange={onClearRange}
            />

            <TransactionsFilterPills
              theme={theme}
              styles={pillStyles}
              typeFilter={typeFilter}
              statusFilter={statusFilter}
              contaFilter={contaFilter}
              contasAtivas={contasAtivas}
              onTypeChange={onTypeChange}
              onStatusChange={onStatusChange}
              onContaChange={onContaChange}
            />
          </ScrollView>

          <View style={styles.sheetFooter}>
            <TouchableOpacity
              onPress={onClearAll}
              style={[styles.footerBtn, styles.footerBtnGhost]}
              accessibilityRole="button"
              accessibilityLabel="Limpar filtros"
            >
              <Text style={[styles.footerBtnGhostText, { color: theme.textSecondary }]}>
                Limpar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.footerBtn, styles.footerBtnPrimary, { backgroundColor: tokens.accent }]}
              accessibilityRole="button"
              accessibilityLabel="Aplicar e fechar"
            >
              <Text style={styles.footerBtnPrimaryText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function createStyles (
  theme: Theme,
  tokens: ReturnType<typeof getTechTokens>,
) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(8, 15, 30, 0.55)',
    },
    sheet: {
      width: '100%',
      maxWidth: 520,
      maxHeight: '86%',
      borderRadius: 16,
      overflow: 'hidden',
      zIndex: 1,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.divider,
    },
    sheetTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sheetTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    closeBtn: {
      padding: 6,
      borderRadius: 8,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    sheetScroll: {
      flexGrow: 0,
    },
    sheetBody: {
      padding: 16,
      gap: mfSpacing.sm,
      paddingBottom: 20,
    },
    sectionLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    sheetFooter: {
      flexDirection: 'row',
      gap: 10,
      padding: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tokens.divider,
    },
    footerBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: mfRadius.sm,
      minHeight: 44,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    footerBtnGhost: {
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: tokens.insetFill,
    },
    footerBtnGhostText: {
      fontSize: 14,
      fontWeight: '600',
    },
    footerBtnPrimary: {},
    footerBtnPrimaryText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  })
}
