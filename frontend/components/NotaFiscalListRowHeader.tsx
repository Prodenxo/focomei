import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import {
  formatDateTime,
  formatNfseStatus,
  getNfseStatusBadgeBackground,
  getNfseStatusBadgeColor,
  getNfseStatusKey,
  meiFiscalDocumentTypeShortLabel,
  resolveNfseDisplayStatus,
} from '../lib/meiFormatters'
import {
  extrairNomeClienteDaNota,
  extrairValorDaNota,
  type ClienteCatalogByDoc,
} from '../lib/notaFiscalDisplay'
import { formatCurrencyBR } from '../lib/numberFormat'
import type { NfseRecord } from '../services/meiNotasService'

interface NotaFiscalListRowHeaderProps {
  nota: Pick<
    NfseRecord,
    | 'id'
    | 'status'
    | 'response_json'
    | 'payload_json'
    | 'document_type'
    | 'created_at'
    | 'protocol'
    | 'plugnotas_id'
    | 'id_integracao'
  >
  textColor: string
  textSecondary: string
  clienteCatalogByDoc?: ClienteCatalogByDoc | null
}

function AdminBadge ({
  label,
  color,
  backgroundColor,
}: {
  label: string
  color: string
  backgroundColor: string
}) {
  return (
    <View style={[styles.badge, { backgroundColor, borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  )
}

export function NotaFiscalListRowHeader ({
  nota,
  textColor,
  textSecondary,
  clienteCatalogByDoc,
}: NotaFiscalListRowHeaderProps) {
  const resolvedStatus = resolveNfseDisplayStatus(nota)
  const statusLabel = formatNfseStatus(resolvedStatus)
  const statusColor = getNfseStatusBadgeColor(resolvedStatus)
  const statusBg = getNfseStatusBadgeBackground(resolvedStatus)
  const isPending = nota.id === '__emit_pending__'
  const valor = isPending ? null : extrairValorDaNota(nota as NfseRecord)
  const cliente = isPending
    ? null
    : extrairNomeClienteDaNota(nota as NfseRecord, clienteCatalogByDoc)
  const referencia = nota.id_integracao || nota.plugnotas_id || nota.protocol || null
  const docLabel = meiFiscalDocumentTypeShortLabel(nota.document_type)
  const clienteLabel = isPending
    ? 'Enviando nota…'
    : cliente || 'Cliente não informado'
  const valorLabel = valor != null ? formatCurrencyBR(valor) : null
  const metaParts = [
    `Emitida em ${formatDateTime(nota.created_at)}`,
    nota.protocol ? `Protocolo ${nota.protocol}` : null,
  ].filter(Boolean)

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={[styles.label, { color: textSecondary }]}>Cliente</Text>
        <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
          {clienteLabel}
        </Text>
        {valorLabel ? (
          <>
            <Text style={[styles.label, styles.labelSpaced, { color: textSecondary }]}>Valor</Text>
            <Text style={[styles.valor, { color: textColor }]} numberOfLines={1}>
              {valorLabel}
            </Text>
          </>
        ) : null}
        <Text style={[styles.meta, { color: textSecondary }]} numberOfLines={2}>
          {metaParts.join(' • ')}
        </Text>
        {referencia && referencia !== cliente ? (
          <Text style={[styles.ref, { color: textSecondary }]} numberOfLines={1}>
            {referencia}
          </Text>
        ) : null}
      </View>
      <View style={styles.badges}>
        <AdminBadge
          label={docLabel}
          color="#475569"
          backgroundColor="rgba(100, 116, 139, 0.16)"
        />
        <AdminBadge
          label={statusLabel}
          color={statusColor}
          backgroundColor={statusBg}
        />
      </View>
    </View>
  )
}

export function getNotaCardAccentColor (nota: Pick<NfseRecord, 'status' | 'response_json'>) {
  return getNfseStatusBadgeColor(resolveNfseDisplayStatus(nota))
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  left: {
    flex: 1,
    minWidth: 0,
    flexBasis: '58%',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    opacity: 0.75,
  },
  labelSpaced: {
    marginTop: 6,
  },
  valor: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 1,
  },
  meta: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  ref: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
    opacity: 0.85,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    flexShrink: 0,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
})
