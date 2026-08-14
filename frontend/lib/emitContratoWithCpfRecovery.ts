import { emitStripeMeiContrato, listMeiPaymentApprovals } from '../services/adminBillingService'
import { isSignatarioCpfMissingError } from './contratoSignatarioCpf'

export interface SignatarioCpfPromptState {
  empresaId: string
  empresaName?: string | null
  userId: string | null
  signatarioName?: string | null
  signatarioEmail?: string | null
}

export async function resolveSignatarioForEmpresa(
  empresaId: string,
): Promise<Pick<SignatarioCpfPromptState, 'userId' | 'signatarioName' | 'signatarioEmail'>> {
  const { items } = await listMeiPaymentApprovals({})
  const item = items.find((row) => row.empresaId === empresaId)
  return {
    userId: item?.ownerId ?? null,
    signatarioName: item?.ownerDisplayName ?? null,
    signatarioEmail: item?.ownerEmail ?? null,
  }
}

export async function emitContratoOrPromptCpf(input: {
  empresaId: string
  empresaName?: string | null
  ownerId?: string | null
  ownerDisplayName?: string | null
  ownerEmail?: string | null
  onCpfRequired: (prompt: SignatarioCpfPromptState) => void
}): Promise<'sent' | 'cpf_prompt'> {
  try {
    await emitStripeMeiContrato(input.empresaId)
    return 'sent'
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? '')
    if (!isSignatarioCpfMissingError(message)) throw err

    const resolved = input.ownerId
      ? {
          userId: input.ownerId,
          signatarioName: input.ownerDisplayName ?? null,
          signatarioEmail: input.ownerEmail ?? null,
        }
      : await resolveSignatarioForEmpresa(input.empresaId)

    input.onCpfRequired({
      empresaId: input.empresaId,
      empresaName: input.empresaName,
      userId: resolved.userId,
      signatarioName: resolved.signatarioName,
      signatarioEmail: resolved.signatarioEmail,
    })
    return 'cpf_prompt'
  }
}
