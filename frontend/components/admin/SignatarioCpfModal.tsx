import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMfTheme } from '../ui/useMfTheme'
import { mfRadius, mfSpacing, mfTypography, type Theme } from '../../lib/theme'
import { maskCpfInput } from '../../lib/contratoSignatarioCpf'
import { isValidCpfDigits } from '../../lib/validateCnpj'
import { updateUser } from '../../lib/user-management'

export interface SignatarioCpfModalProps {
  visible: boolean
  userId: string | null
  signatarioName?: string | null
  signatarioEmail?: string | null
  empresaName?: string | null
  onClose: () => void
  onSaved: () => void | Promise<void>
}

export function SignatarioCpfModal({
  visible,
  userId,
  signatarioName,
  signatarioEmail,
  empresaName,
  onClose,
  onSaved,
}: SignatarioCpfModalProps) {
  const { theme } = useMfTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const [cpf, setCpf] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible) {
      setCpf('')
      setError('')
      setLoading(false)
    }
  }, [visible])

  const handleSubmit = async () => {
    if (!userId) {
      setError('Não foi possível identificar o signatário. Abra Cobrança e tente de novo.')
      return
    }
    const digits = cpf.replace(/\D/g, '')
    if (!isValidCpfDigits(digits)) {
      setError('Informe um CPF válido.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await updateUser(userId, { cpf: digits })
      await onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar CPF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={loading ? undefined : onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: theme.warningLight }]}>
              <Ionicons name="id-card-outline" size={22} color={theme.warning} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>CPF do signatário</Text>
              <Text style={styles.subtitle}>
                O contrato Onety exige o CPF do admin da empresa.
                {empresaName ? ` (${empresaName})` : ''}
              </Text>
            </View>
          </View>

          {(signatarioName || signatarioEmail) ? (
            <View style={styles.signatarioBox}>
              {signatarioName ? (
                <Text style={styles.signatarioLine}>{signatarioName}</Text>
              ) : null}
              {signatarioEmail ? (
                <Text style={styles.signatarioEmail}>{signatarioEmail}</Text>
              ) : null}
            </View>
          ) : null}

          <Text style={styles.label}>CPF</Text>
          <TextInput
            style={styles.input}
            value={cpf}
            onChangeText={(v) => setCpf(maskCpfInput(v))}
            placeholder="000.000.000-00"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            autoComplete="off"
            editable={!loading}
            accessibilityLabel="CPF do signatário"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              onPress={onClose}
              disabled={loading}
              accessibilityRole="button"
            >
              <Text style={styles.btnSecondaryText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary, { backgroundColor: theme.primary }]}
              onPress={() => void handleSubmit()}
              disabled={loading}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>Salvar e gerar contrato</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: mfSpacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 440,
      backgroundColor: theme.surface,
      borderRadius: mfRadius.lg,
      padding: mfSpacing.lg,
      borderWidth: 1,
      borderColor: theme.border,
    },
    header: {
      flexDirection: 'row',
      gap: mfSpacing.md,
      marginBottom: mfSpacing.md,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: mfRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
    },
    title: {
      ...mfTypography.h3,
      color: theme.text,
    },
    subtitle: {
      ...mfTypography.bodySm,
      color: theme.textSecondary,
      marginTop: 4,
    },
    signatarioBox: {
      backgroundColor: theme.background,
      borderRadius: mfRadius.md,
      padding: mfSpacing.md,
      marginBottom: mfSpacing.md,
    },
    signatarioLine: {
      ...mfTypography.body,
      color: theme.text,
      fontWeight: '600',
    },
    signatarioEmail: {
      ...mfTypography.bodySm,
      color: theme.textSecondary,
      marginTop: 2,
    },
    label: {
      ...mfTypography.label,
      color: theme.textSecondary,
      marginBottom: mfSpacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: mfRadius.md,
      paddingHorizontal: mfSpacing.md,
      paddingVertical: mfSpacing.sm,
      color: theme.text,
      ...mfTypography.body,
      marginBottom: mfSpacing.sm,
    },
    error: {
      ...mfTypography.bodySm,
      color: theme.error,
      marginBottom: mfSpacing.sm,
    },
    actions: {
      flexDirection: 'row',
      gap: mfSpacing.sm,
      marginTop: mfSpacing.sm,
    },
    btn: {
      flex: 1,
      borderRadius: mfRadius.md,
      paddingVertical: mfSpacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    btnSecondary: {
      borderWidth: 1,
      borderColor: theme.border,
    },
    btnSecondaryText: {
      ...mfTypography.body,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    btnPrimary: {},
    btnPrimaryText: {
      ...mfTypography.body,
      color: '#fff',
      fontWeight: '600',
    },
  })
}
