/**
 * Configuração do limite de referência MEI (valor por ano civil).
 * Valores são referência administrativa para a UI; conferir legislação vigente.
 */

export const MEI_LIMITE_REFERENCIA_REAIS_BY_YEAR = Object.freeze({
  2024: 81_000,
  2025: 81_000,
  2026: 81_000,
});

export const MEI_LIMITE_VIGENCIA_LABEL_BY_YEAR = Object.freeze({
  2024: 'Referência 2024',
  2025: 'Referência 2025',
  2026: 'Referência 2026',
});

export const DEFAULT_MEI_LIMITE_THRESHOLDS = Object.freeze({
  atencaoMinPercent: 80,
  criticoMinPercent: 95,
});

/** @param {number} anoCivil */
export function getLimiteReferenciaReaisParaAno(anoCivil) {
  const v = MEI_LIMITE_REFERENCIA_REAIS_BY_YEAR[anoCivil];
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

/** @param {number} anoCivil */
export function getVigenciaLabelParaAno(anoCivil) {
  const label = MEI_LIMITE_VIGENCIA_LABEL_BY_YEAR[anoCivil];
  return typeof label === 'string' && label.trim() ? label.trim() : null;
}
