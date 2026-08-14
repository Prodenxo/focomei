export const SIGNATARIO_CPF_MISSING_RE = /CPF do signat[aá]rio/i

export function isSignatarioCpfMissingError(message: string): boolean {
  return SIGNATARIO_CPF_MISSING_RE.test(message)
}

export function maskCpfInput(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length > 9) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  }
  if (d.length > 6) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  }
  if (d.length > 3) {
    return `${d.slice(0, 3)}.${d.slice(3)}`
  }
  return d
}
