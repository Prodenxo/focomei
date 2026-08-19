import { emitStripeMeiContrato, getContratoSignatario, type EmitStripeMeiContratoInput } from '../services/adminBillingService'
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
  try {
    const { signatario } = await getContratoSignatario(empresaId)
    return {
      userId: signatario.userId,
      signatarioName: signatario.displayName || null,
      signatarioEmail: signatario.email || null,
    }
  } catch {
    return {
      userId: null,
      signatarioName: null,
      signatarioEmail: null,
    }
  }
}

export async function emitContratoOrPromptCpf(input: {
  empresaId: string
  empresaName?: string | null
  ownerId?: string | null
  ownerDisplayName?: string | null
  ownerEmail?: string | null
  funilId?: number | null
  vendedorId?: number | null
  valor?: number | null
  onCpfRequired: (prompt: SignatarioCpfPromptState) => void
}): Promise<'sent' | 'cpf_prompt'> {
  const emitBody: EmitStripeMeiContratoInput = {
    empresaId: input.empresaId,
    funilId: input.funilId ?? undefined,
    vendedorId: input.vendedorId ?? undefined,
    valor: input.valor ?? undefined,
  }

  try {
    await emitStripeMeiContrato(emitBody)
    return 'sent'
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? '')
    if (!isSignatarioCpfMissingError(message)) throw err

    const resolved = await resolveSignatarioForEmpresa(input.empresaId)
    const userId = input.ownerId || resolved.userId

    input.onCpfRequired({
      empresaId: input.empresaId,
      empresaName: input.empresaName,
      userId,
      signatarioName: input.ownerDisplayName || resolved.signatarioName,
      signatarioEmail: input.ownerEmail || resolved.signatarioEmail,
    })
    return 'cpf_prompt'
  }
}
