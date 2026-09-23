/**
 * Mantém os tributos informados pelo usuário/catálogo.
 *
 * Não existe endpoint backend para calcular NCM/CSOSN/CFOP. Alterar esses campos
 * no navegador seria inventar regra fiscal; a emissão continua sendo validada
 * pelo backend e pelo emissor.
 */
export async function recalculateNfeItemsTax(items) {
  return Array.isArray(items) ? items : [];
}
