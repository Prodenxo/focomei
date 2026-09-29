/**
 * Rótulos de listagem do catálogo fiscal (API usa `discriminacao`, não `nome`).
 * @param {Record<string, unknown>|null|undefined} item
 */
export function catalogProdutoTitle(item) {
  if (!item || typeof item !== 'object') return '—';
  const meta = item.metadata_json && typeof item.metadata_json === 'object'
    ? item.metadata_json
    : {};
  const text = [
    item.discriminacao,
    item.descricao,
    item.nome,
    item.titulo,
    meta.cnaeDescricao,
  ].map((v) => String(v ?? '').trim()).find(Boolean);
  if (text) return text;
  const cnae = String(item.cnae ?? '').replace(/\D/g, '');
  if (cnae) return `Serviço — CNAE ${cnae}`;
  return '—';
}

function catalogProdutoMeta(item) {
  return item?.metadata_json && typeof item.metadata_json === 'object' && !Array.isArray(item.metadata_json)
    ? item.metadata_json
    : {};
}

/** NCM gravado no produto (dados extras) ou no campo antigo. */
export function catalogProdutoNcmInput(item) {
  if (!item || typeof item !== 'object') return '';
  const fromMeta = String(catalogProdutoMeta(item).ncm ?? '').replace(/\D/g, '').slice(0, 8);
  if (fromMeta) return fromMeta;
  return String(item.ncm ?? '').replace(/\D/g, '').slice(0, 8);
}

/** CFOP gravado no produto. Sem nada salvo, o padrão da venda interna é 5102. */
export function catalogProdutoCfopInput(item) {
  if (!item || typeof item !== 'object') return '5102';
  const fromMeta = String(catalogProdutoMeta(item).cfop ?? item.cfop ?? '').replace(/\D/g, '').slice(0, 4);
  return fromMeta || '5102';
}

/**
 * Guarda NCM e CFOP nos dados extras do produto, sem apagar o que já estava lá.
 * @param {unknown} existing
 * @param {{ ncm?: string, cfop?: string }} fields
 */
export function catalogProdutoNfeMetadata(existing, fields = {}) {
  const previous = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? { ...existing }
    : {};
  const ncm = String(fields.ncm ?? '').replace(/\D/g, '').slice(0, 8);
  const cfop = String(fields.cfop ?? '').replace(/\D/g, '').slice(0, 4);
  if (ncm) previous.ncm = ncm;
  else delete previous.ncm;
  if (cfop) previous.cfop = cfop;
  else delete previous.cfop;
  return previous;
}

/** @param {Record<string, unknown>|null|undefined} item */
export function catalogProdutoSubtitle(item) {
  if (!item || typeof item !== 'object') return '—';
  const codigo = String(item.codigo ?? item.codigoServico ?? '').trim();
  const ncm = catalogProdutoNcmInput(item);
  if (codigo && ncm.length === 8) return `Cód. ${codigo} · NCM ${ncm}`;
  if (codigo) return `Cód. serviço ${codigo}`;
  const cnae = String(item.cnae ?? '').replace(/\D/g, '');
  if (cnae) return `CNAE ${cnae}`;
  if (ncm) return `NCM ${ncm}`;
  const meta = item.metadata_json && typeof item.metadata_json === 'object'
    ? item.metadata_json
    : {};
  if (meta.needsServicoCodigo) return 'Completar código LC 116';
  return '—';
}

/** @param {unknown} value */
export function catalogProdutoValorSugerido(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Valor sugerido pronto para campo de dinheiro ("150,00").
 * A API devolve a coluna numérica como texto, então nunca chamar `.toFixed` direto.
 * @param {unknown} value
 */
export function catalogProdutoValorSugeridoInput(value) {
  const n = catalogProdutoValorSugerido(value);
  if (n === null || n <= 0) return '';
  return n.toFixed(2).replace('.', ',');
}
