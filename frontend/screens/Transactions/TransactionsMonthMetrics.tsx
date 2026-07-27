import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MfTechKpiCard } from '../../components/ui';
import { useMfTheme } from '../../components/ui/useMfTheme';
import { formatCurrencyBR } from '../../lib/numberFormat';
import { getFinanceSemanticColor, mfSpacing, type Theme } from '../../lib/theme';
import { useLayoutProfile } from '../../lib/useLayoutProfile';

type Props = {
  entradas: number;
  saidas: number;
  saldo: number;
  countEntradas: number;
  countSaidas: number;
};

const monoFont = Platform.select({
  web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: undefined,
}) as ViewStyle['fontFamily'];

/**
 * KPIs em faixa horizontal — legível sem comer a lista.
 */
export function TransactionsMonthMetrics({
  entradas,
  saidas,
  saldo,
  countEntradas,
  countSaidas,
}: Props) {
  const { theme } = useMfTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const layout = useLayoutProfile(containerWidth);
  const isWide = layout.isWide;

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setContainerWidth((prev) => (prev === next ? prev : next));
  }, []);

  const styles = useMemo(() => createStyles(theme, isWide), [theme, isWide]);

  const saldoColor = getFinanceSemanticColor(theme, saldo >= 0 ? 'received' : 'overdue');
  const incomeColor = getFinanceSemanticColor(theme, 'received');
  const expenseColor = getFinanceSemanticColor(theme, 'overdue');

  const entradasHint = countEntradas === 1 ? '1 lanç.' : `${countEntradas} lanç.`;
  const saidasHint = countSaidas === 1 ? '1 lanç.' : `${countSaidas} lanç.`;
  const saldoHint = saldo >= 0 ? 'Positivo' : 'Negativo';

  return (
    <View style={styles.root} onLayout={onLayout}>
      <View style={isWide ? styles.row : styles.stack}>
        <Kpi
          label="Saldo"
          value={formatCurrencyBR(saldo)}
          hint={saldoHint}
          color={saldoColor}
          icon="wallet-outline"
          styles={styles}
          featured
        />
        <Kpi
          label="Entradas"
          value={formatCurrencyBR(entradas)}
          hint={entradasHint}
          color={incomeColor}
          icon="trending-up-outline"
          styles={styles}
        />
        <Kpi
          label="Saídas"
          value={formatCurrencyBR(saidas)}
          hint={saidasHint}
          color={expenseColor}
          icon="trending-down-outline"
          styles={styles}
        />
      </View>
    </View>
  );
}

function Kpi({
  label,
  value,
  hint,
  color,
  icon,
  styles,
  featured = false,
}: {
  label: string;
  value: string;
  hint: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  styles: ReturnType<typeof createStyles>;
  featured?: boolean;
}) {
  return (
    <MfTechKpiCard
      level={featured ? 'featured' : 'metric'}
      style={styles.card}
      innerStyle={styles.cardInner}
    >
      <View style={styles.head}>
        <View style={[styles.iconWrap, { backgroundColor: `${color}22` }]}>
          <Ionicons name={icon} size={13} color={color} />
        </View>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Text style={[styles.value, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </MfTechKpiCard>
  );
}

function createStyles(theme: Theme, isWide: boolean) {
  return StyleSheet.create({
    root: {
      width: '100%',
      marginBottom: 4,
      overflow: 'visible',
    },
    row: {
      flexDirection: 'row',
      gap: mfSpacing.sm,
      overflow: 'visible',
    },
    stack: {
      gap: mfSpacing.sm,
      overflow: 'visible',
    },
    card: {
      flex: isWide ? 1 : undefined,
      width: isWide ? undefined : '100%',
      minWidth: 0,
      marginVertical: 0,
      marginHorizontal: 0,
      overflow: 'visible',
    },
    cardInner: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 4,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    iconWrap: {
      width: 22,
      height: 22,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: theme.textSecondary,
    },
    hint: {
      marginLeft: 'auto',
      fontSize: 10,
      color: theme.textTertiary,
      fontWeight: '500',
    },
    value: {
      fontSize: isWide ? 20 : 22,
      fontWeight: '800',
      letterSpacing: -0.6,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
    },
  });
}
