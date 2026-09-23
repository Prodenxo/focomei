const TECHNICAL_MARKERS = [
  'serpro',
  'backend',
  'modalidade',
  'acionamento',
  'destinatario',
  'integra contador',
  'termo de autorização',
]

/** Avisos que o cliente precisa ler na íntegra, mesmo longos. */
const USER_ACTIONABLE_PATTERNS = [
  /certificado digital venceu em \d{2}\/\d{2}\/\d{4}/i,
  /certificado digital só passa a valer em \d{2}\/\d{2}\/\d{4}/i,
]

export function toMeiUserErrorMessage (raw: string | null | undefined): string {
  if (!raw?.trim()) {
    return 'Não foi possível consultar agora. Tente de novo.'
  }
  if (USER_ACTIONABLE_PATTERNS.some((pattern) => pattern.test(raw))) {
    return raw.trim()
  }
  const lower = raw.toLowerCase()
  if (TECHNICAL_MARKERS.some((marker) => lower.includes(marker))) {
    return 'Não foi possível consultar agora. Tente de novo.'
  }
  if (raw.length > 120) {
    return 'Não foi possível consultar agora. Tente de novo.'
  }
  return raw
}
