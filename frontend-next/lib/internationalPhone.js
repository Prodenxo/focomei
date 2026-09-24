export function normalizePhoneDigits(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

export function phonesMatch(left, right) {
  return normalizePhoneDigits(left) === normalizePhoneDigits(right);
}

/** Brasil: DDD + 8 ou 9 dígitos. */
export function getBrazilPhoneValidationError(digits) {
  const d = normalizePhoneDigits(digits);
  if (!d.startsWith('55')) return null;
  const national = d.slice(2);
  if (!national || national.length < 10 || national.length > 11) {
    return 'Telefone inválido. Informe DDD + número (10 ou 11 dígitos).';
  }
  return null;
}

export function formatPhoneBrCell(digits) {
  const d = normalizePhoneDigits(digits);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

/** Brasil: DDD + 9 dígitos. Fora dele, o teto do E.164 menos o código do país. */
const NATIONAL_MAX_DIGITS = { br: 11 };
const NATIONAL_MAX_DIGITS_FALLBACK = 15;

/**
 * A máscara brasileira só desenha 11 dígitos. Como o campo relê o próprio texto
 * formatado a cada tecla, dígito além do teto some e embaralha o resto — então o
 * corte tem de acontecer aqui, antes de virar estado.
 */
export function limitNationalDigits(countryIso, nationalDigits) {
  const digits = normalizePhoneDigits(nationalDigits);
  const max = NATIONAL_MAX_DIGITS[countryIso] ?? NATIONAL_MAX_DIGITS_FALLBACK;
  return digits.slice(0, max);
}

/**
 * Recebe só os dígitos nacionais (DDD + número) — o código do país fica no seletor
 * ao lado. `formatPhoneBrCell` já trata os dois primeiros dígitos como DDD, então
 * nada de prefixo aqui: DDD 55 (Santa Maria) é um DDD legítimo.
 */
export function formatNationalPhoneInput(countryIso, nationalDigits) {
  const digits = limitNationalDigits(countryIso, nationalDigits);
  if (!digits) return '';
  if (countryIso === 'br') return formatPhoneBrCell(digits);
  return digits;
}
