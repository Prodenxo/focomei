import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MfScrollView } from '../ui/MfScrollView';
import { MfTechKpiCard } from '../ui/MfTechKpiCard';
import { useMfTheme } from '../ui/useMfTheme';
import type { Theme } from '../../lib/theme';
import { mfRadius, mfSpacing, mfTypography } from '../../lib/theme';
import { getTechTokens, mfTechInsetSurface, mfTechPanelChrome } from '../../lib/techDesign';
import {
  emitStripeMeiContrato,
  listMeiPaymentApprovals,
  type ListMeiPaymentApprovalsQuery,
  type MeiPaymentApprovalItem,
  type MeiPaymentApprovalsSummary,
} from '../../services/adminBillingService';
import type { EmpresaOption } from '../../services/empresaService';

type PaymentFilter = '' | 'pix' | 'card';
type ContratoFilter = '' | 'pending' | 'sent' | 'failed' | 'skipped';
type AccessFilter = '' | 'yes' | 'no';

interface Props {
  theme: Theme;
  isDesktop: boolean;
  onOpenBilling?: (empresa: EmpresaOption) => void;
  onFeedback?: (payload: { type: 'success' | 'error'; message: string }) => void;
}

const formatBrl = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR');
};

const lineStatusLabel = (status: string) => {
  if (status === 'active') return 'Pago / ativo';
  if (status === 'pending') return 'Pendente';
  if (status === 'cancelled') return 'Cancelado';
  return status || '—';
};

function toneForContrato(status: MeiPaymentApprovalItem['contratoStatus'], theme: Theme) {
  if (status === 'sent') return { bg: theme.successLight, fg: theme.success };
  if (status === 'failed') return { bg: theme.errorLight, fg: theme.error };
  if (status === 'skipped') return { bg: theme.surface, fg: theme.textSecondary };
  return { bg: '#FEF3C7', fg: theme.warning };
}

function toneForPayment(channel: MeiPaymentApprovalItem['paymentChannel'], theme: Theme) {
  if (channel === 'pix') return { bg: '#ECFDF5', fg: theme.success };
  if (channel === 'card') return { bg: theme.primaryLight, fg: theme.primary };
  return { bg: theme.surface, fg: theme.textSecondary };
}

export function MeiPaymentApprovalsTab({
  theme,
  isDesktop,
  onOpenBilling,
  onFeedback,
}: Props) {
  const { isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const panelChrome = useMemo(() => mfTechPanelChrome(isDarkMode, 'surface'), [isDarkMode]);
  const insetSurface = useMemo(() => mfTechInsetSurface(isDarkMode, false), [isDarkMode]);
  const styles = useMemo(
    () => createStyles(theme, tokens, isDesktop, isDarkMode),
    [theme, tokens, isDesktop, isDarkMode],
  );

  const [items, setItems] = useState<MeiPaymentApprovalItem[]>([]);
  const [summary, setSummary] = useState<MeiPaymentApprovalsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('');
  const [contratoFilter, setContratoFilter] = useState<ContratoFilter>('');
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('');
  const [emittingId, setEmittingId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query: ListMeiPaymentApprovalsQuery = {
        status: 'active',
      };
      if (paymentFilter) query.paymentChannel = paymentFilter;
      if (contratoFilter) query.contratoStatus = contratoFilter;
      if (accessFilter) query.accessReleased = accessFilter;
      if (search.trim()) query.search = search.trim();

      const data = await listMeiPaymentApprovals(query);
      setItems(data.items || []);
      setSummary(data.summary || null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar aprovações';
      setError(message);
      onFeedback?.({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  }, [accessFilter, contratoFilter, onFeedback, paymentFilter, search]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleEmitContrato = async (item: MeiPaymentApprovalItem) => {
    setEmittingId(item.lineId);
    try {
      await emitStripeMeiContrato(item.empresaId);
      onFeedback?.({ type: 'success', message: `Contrato reenviado para ${item.empresaName}` });
      await loadItems();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar contrato';
      onFeedback?.({ type: 'error', message });
    } finally {
      setEmittingId(null);
    }
  };

  const filterChips = [
    { key: '' as PaymentFilter, label: 'Todos pagamentos' },
    { key: 'pix' as PaymentFilter, label: `PIX (${summary?.pix ?? '…'})` },
    { key: 'card' as PaymentFilter, label: `Cartão (${summary?.card ?? '…'})` },
  ];

  const contratoChips = [
    { key: '' as ContratoFilter, label: 'Contrato: todos' },
    { key: 'sent' as ContratoFilter, label: 'Enviado' },
    { key: 'pending' as ContratoFilter, label: 'Pendente' },
    { key: 'failed' as ContratoFilter, label: 'Falhou' },
  ];

  const accessChips = [
    { key: '' as AccessFilter, label: 'Acesso: todos' },
    { key: 'yes' as AccessFilter, label: 'Liberado' },
    { key: 'no' as AccessFilter, label: 'Não liberado' },
  ];

  return (
    <MfScrollView style={styles.container} contentContainerStyle={styles.scrollContent} hideLegalFooter>
      <View style={[styles.heroPanel, panelChrome]}>
        <View style={styles.heroHeader}>
          <Ionicons name="receipt-outline" size={20} color={tokens.accent} />
          <View style={styles.heroTextCol}>
            <Text style={styles.heroTitle}>Aprovações MEI</Text>
            <Text style={styles.heroSubtitle}>
              Quem pagou via PIX ou cartão, se o acesso foi liberado e se o contrato Onety foi gerado.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.refreshBtn, { backgroundColor: tokens.accent }]}
            onPress={() => void loadItems()}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Atualizar lista de aprovações"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
                <Text style={styles.refreshBtnText}>Atualizar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {summary ? (
          <View style={styles.statsRow}>
            {[
              { label: 'Ativos', value: summary.total },
              { label: 'PIX', value: summary.pix },
              { label: 'Cartão', value: summary.card },
              { label: 'Acesso OK', value: summary.accessReleased },
              { label: 'Contrato OK', value: summary.contratoSent },
            ].map((stat) => (
              <View key={stat.label} style={[styles.statCard, insetSurface]}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={[styles.filtersPanel, panelChrome]}>
        <View style={[styles.searchBox, insetSurface]}>
          <Ionicons name="search" size={16} color={theme.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Empresa, CNPJ, admin ou e-mail"
            placeholderTextColor={theme.placeholder}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => void loadItems()}
          />
        </View>

        <View style={styles.chipRow}>
          {filterChips.map((chip) => {
            const selected = paymentFilter === chip.key;
            return (
              <TouchableOpacity
                key={chip.key || 'all-payment'}
                style={[
                  styles.chip,
                  insetSurface,
                  selected && { borderColor: tokens.accent, backgroundColor: tokens.accentSoft },
                ]}
                onPress={() => setPaymentFilter(chip.key)}
              >
                <Text style={[styles.chipText, selected && { color: tokens.accent, fontWeight: '700' }]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.chipRow}>
          {contratoChips.map((chip) => {
            const selected = contratoFilter === chip.key;
            return (
              <TouchableOpacity
                key={chip.key || 'all-contrato'}
                style={[
                  styles.chip,
                  insetSurface,
                  selected && { borderColor: tokens.accent, backgroundColor: tokens.accentSoft },
                ]}
                onPress={() => setContratoFilter(chip.key)}
              >
                <Text style={[styles.chipText, selected && { color: tokens.accent, fontWeight: '700' }]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.chipRow}>
          {accessChips.map((chip) => {
            const selected = accessFilter === chip.key;
            return (
              <TouchableOpacity
                key={chip.key || 'all-access'}
                style={[
                  styles.chip,
                  insetSurface,
                  selected && { borderColor: tokens.accent, backgroundColor: tokens.accentSoft },
                ]}
                onPress={() => setAccessFilter(chip.key)}
              >
                <Text style={[styles.chipText, selected && { color: tokens.accent, fontWeight: '700' }]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: theme.errorLight }]}>
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={tokens.accent} />
          <Text style={styles.loadingText}>Carregando aprovações…</Text>
        </View>
      ) : null}

      {!loading && items.length === 0 ? (
        <View style={[styles.emptyBox, panelChrome]}>
          <Ionicons name="document-text-outline" size={28} color={theme.textTertiary} />
          <Text style={styles.emptyTitle}>Nenhuma aprovação encontrada</Text>
          <Text style={styles.emptySubtitle}>Ajuste os filtros ou confirme pagamentos PIX / Stripe.</Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {items.map((item) => {
          const paymentTone = toneForPayment(item.paymentChannel, theme);
          const contratoTone = toneForContrato(item.contratoStatus, theme);
          const isEmitting = emittingId === item.lineId;

          return (
            <MfTechKpiCard key={item.lineId} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTitleCol}>
                  <Text style={styles.itemTitle}>{item.empresaName}</Text>
                  <Text style={styles.itemMeta}>
                    {item.meiSlots} vagas MEI · {formatBrl(Number(item.valueNumeric || 0))}
                  </Text>
                  {item.ownerEmail ? (
                    <Text style={styles.itemMeta}>Admin: {item.ownerDisplayName || item.ownerEmail}</Text>
                  ) : null}
                </View>
                <View style={[styles.badge, { backgroundColor: paymentTone.bg }]}>
                  <Text style={[styles.badgeText, { color: paymentTone.fg }]}>{item.paymentChannelLabel}</Text>
                </View>
              </View>

              <View style={styles.itemGrid}>
                <View style={styles.itemFact}>
                  <Text style={styles.factLabel}>Pagamento</Text>
                  <Text style={styles.factValue}>{lineStatusLabel(item.lineStatus)}</Text>
                </View>
                <View style={styles.itemFact}>
                  <Text style={styles.factLabel}>Aprovado em</Text>
                  <Text style={styles.factValue}>{formatDateTime(item.approvedAt || item.createdAt)}</Text>
                </View>
                <View style={styles.itemFact}>
                  <Text style={styles.factLabel}>Acesso admin</Text>
                  <Text style={[styles.factValue, { color: item.accessReleased ? theme.success : theme.error }]}>
                    {item.accessReleased ? 'Liberado (MEI)' : 'Não liberado'}
                  </Text>
                </View>
                <View style={styles.itemFact}>
                  <Text style={styles.factLabel}>Contrato</Text>
                  <View style={[styles.badge, { backgroundColor: contratoTone.bg, alignSelf: 'flex-start' }]}>
                    <Text style={[styles.badgeText, { color: contratoTone.fg }]}>
                      {item.contratoStatusLabel}
                    </Text>
                  </View>
                </View>
              </View>

              {item.approvedByEmail ? (
                <Text style={styles.approverText}>Confirmado por: {item.approvedByEmail}</Text>
              ) : null}

              {item.contratoError ? (
                <Text style={[styles.contratoError, { color: theme.error }]} numberOfLines={3}>
                  {item.contratoError}
                </Text>
              ) : null}

              <View style={styles.actionsRow}>
                {onOpenBilling ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, insetSurface]}
                    onPress={() =>
                      onOpenBilling({
                        id: item.empresaId,
                        empresa: item.empresaName,
                      })
                    }
                    accessibilityRole="button"
                  >
                    <Ionicons name="card-outline" size={16} color={tokens.accent} />
                    <Text style={styles.actionBtnText}>Cobrança</Text>
                  </TouchableOpacity>
                ) : null}
                {item.contratoStatus !== 'sent' ? (
                  <TouchableOpacity
                    style={[styles.actionBtnPrimary, { backgroundColor: tokens.accent }, isEmitting && styles.disabledBtn]}
                    onPress={() => void handleEmitContrato(item)}
                    disabled={isEmitting}
                    accessibilityRole="button"
                  >
                    {isEmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.actionBtnPrimaryText}>Gerar contrato</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            </MfTechKpiCard>
          );
        })}
      </View>
    </MfScrollView>
  );
}

function createStyles(
  theme: Theme,
  tokens: ReturnType<typeof getTechTokens>,
  isDesktop: boolean,
  isDarkMode: boolean,
) {
  return StyleSheet.create({
    container: { flex: 1 },
    scrollContent: {
      paddingBottom: mfSpacing.xl,
      gap: mfSpacing.md,
    },
    heroPanel: {
      padding: mfSpacing.lg,
      gap: mfSpacing.md,
    },
    heroHeader: {
      flexDirection: isDesktop ? 'row' : 'column',
      alignItems: isDesktop ? 'center' : 'flex-start',
      gap: mfSpacing.md,
    },
    heroTextCol: { flex: 1, gap: 4 },
    heroTitle: {
      ...mfTypography.titleSm,
      color: theme.text,
      fontWeight: '700',
    },
    heroSubtitle: {
      ...mfTypography.bodySm,
      color: theme.textSecondary,
    },
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: mfRadius.md,
    },
    refreshBtnText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14,
    },
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: mfSpacing.sm,
    },
    statCard: {
      minWidth: isDesktop ? 110 : 88,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: mfRadius.md,
    },
    statValue: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.text,
    },
    statLabel: {
      ...mfTypography.caption,
      color: theme.textSecondary,
      marginTop: 2,
    },
    filtersPanel: {
      padding: mfSpacing.lg,
      gap: mfSpacing.sm,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: mfRadius.md,
    },
    searchInput: {
      flex: 1,
      color: theme.text,
      fontSize: 14,
      padding: 0,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    chipText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    errorBox: {
      padding: mfSpacing.md,
      borderRadius: mfRadius.md,
    },
    errorText: {
      fontSize: 14,
    },
    loadingBox: {
      padding: mfSpacing.xl,
      alignItems: 'center',
      gap: 8,
    },
    loadingText: {
      color: theme.textSecondary,
    },
    emptyBox: {
      padding: mfSpacing.xl,
      alignItems: 'center',
      gap: 8,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    list: {
      gap: mfSpacing.sm,
    },
    itemCard: {
      padding: mfSpacing.lg,
      gap: mfSpacing.sm,
    },
    itemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: mfSpacing.sm,
    },
    itemTitleCol: {
      flex: 1,
      gap: 2,
    },
    itemTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    itemMeta: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      alignSelf: 'flex-start',
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '700',
    },
    itemGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: mfSpacing.md,
    },
    itemFact: {
      minWidth: isDesktop ? 140 : 120,
      gap: 2,
    },
    factLabel: {
      fontSize: 11,
      color: theme.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    factValue: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '600',
    },
    approverText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    contratoError: {
      fontSize: 12,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: mfRadius.md,
    },
    actionBtnText: {
      color: theme.text,
      fontWeight: '600',
      fontSize: 13,
    },
    actionBtnPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: mfRadius.md,
    },
    actionBtnPrimaryText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 13,
    },
    disabledBtn: {
      opacity: 0.6,
    },
  });
}
