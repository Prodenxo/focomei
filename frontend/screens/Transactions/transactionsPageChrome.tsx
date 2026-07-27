import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MfPeriodNav } from '../../components/ui';
import { mfSpacing, mfTypography } from '../../lib/theme';
import type { Theme } from '../../lib/theme';
import { getTechTokens } from '../../lib/techDesign';
import { useMfTheme } from '../../components/ui/useMfTheme';
import { TransactionsHeaderActions } from './TransactionsHeaderActions';

type Props = {
  theme: Theme;
  monthLabel: string;
  movementCount: number;
  monthsAhead: number;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onGoToCurrentMonth: () => void;
  onAddTransaction: () => void;
  onExport: () => void;
  exporting?: boolean;
  /** Sem painel próprio — conteúdo dentro do shell unificado */
  bare?: boolean;
  /** Rótulo do período quando não está no modo mês (ex.: Essa semana). */
  periodHint?: string;
  onOpenFilters?: () => void;
  filtersActiveCount?: number;
};

/**
 * Cabeçalho denso: título + ações numa linha; mês/período na mesma faixa.
 */
export function TransactionsPageChrome({
  theme,
  monthLabel,
  movementCount,
  monthsAhead,
  onPrevMonth,
  onNextMonth,
  onGoToCurrentMonth,
  onAddTransaction,
  onExport,
  exporting = false,
  bare = false,
  periodHint,
  onOpenFilters,
  filtersActiveCount = 0,
}: Props) {
  const { isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, bare), [theme, bare]);

  const movementLabel =
    movementCount === 1 ? '1 movimentação' : `${movementCount} movimentações`;

  const showMonthNav = Boolean(onPrevMonth && onNextMonth);

  return (
    <View style={styles.wrap}>
      <View style={styles.commandRow}>
        <View style={styles.titleCol}>
          <View style={styles.eyebrowRow}>
            <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
            <Text style={[styles.eyebrow, { color: tokens.accent }]}>Extrato</Text>
            <Text style={[styles.metaDot, { color: theme.textTertiary }]}>·</Text>
            <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>
              {movementLabel}
            </Text>
          </View>
          <Text style={styles.title}>Transações</Text>
        </View>

        <View style={styles.rightCol}>
          {showMonthNav ? (
            <View style={styles.periodInline}>
              <MfPeriodNav
                label={monthLabel}
                onPrevious={onPrevMonth}
                onNext={onNextMonth}
                variant="tech"
              />
              {monthsAhead !== 0 ? (
                <TouchableOpacity
                  onPress={onGoToCurrentMonth}
                  style={[
                    styles.currentMonthChip,
                    {
                      borderColor: tokens.insetBorder,
                      backgroundColor: tokens.accentSoft,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Voltar para o mês atual"
                >
                  <Ionicons name="return-up-back-outline" size={13} color={tokens.accent} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: tokens.accent }}>
                    Atual
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : periodHint ? (
            <View
              style={[
                styles.periodHintChip,
                { borderColor: tokens.insetBorder, backgroundColor: tokens.insetFill },
              ]}
            >
              <Ionicons name="calendar-outline" size={13} color={tokens.accent} />
              <Text style={[styles.periodHintText, { color: theme.text }]} numberOfLines={1}>
                {periodHint}
              </Text>
            </View>
          ) : null}

          <TransactionsHeaderActions
            theme={theme}
            exporting={exporting}
            onExport={onExport}
            onAddTransaction={onAddTransaction}
            onOpenFilters={onOpenFilters}
            filtersActiveCount={filtersActiveCount}
            variant="full"
          />
        </View>
      </View>
    </View>
  );
}

function createStyles(theme: Theme, bare: boolean) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      paddingHorizontal: bare ? 0 : mfSpacing.md,
      paddingTop: bare ? 0 : mfSpacing.md,
      paddingBottom: 4,
      gap: 0,
    },
    commandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: mfSpacing.md,
      flexWrap: 'wrap',
    },
    titleCol: {
      flexShrink: 1,
      minWidth: 140,
    },
    rightCol: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      flex: 1,
    },
    periodInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    currentMonthChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderRadius: 999,
      borderWidth: 1,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    periodHintChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      maxWidth: 220,
    },
    periodHintText: {
      fontSize: 12,
      fontWeight: '600',
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
      flexWrap: 'wrap',
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    metaDot: {
      fontSize: 12,
    },
    meta: {
      fontSize: 12,
      fontWeight: '500',
    },
    title: {
      ...mfTypography.titleLarge,
      color: theme.text,
      letterSpacing: -0.4,
      fontSize: 18,
    },
  });
}
