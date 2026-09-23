/**
 * Numeração informada manualmente pelo usuário (NFS-e/DPS e NF-e).
 *
 * O alocador automático nunca desce abaixo do maior número já visto no histórico
 * PlugNotas, o que impede corrigir um contador inflado por notas rejeitadas ou por
 * numeração vinda de outro emissor. O override registrado aqui vence o histórico
 * uma única vez: é consumido na primeira tentativa de emissão e, se houver
 * duplicidade de verdade, o retry volta à regra automática.
 */

const TABLE = 'mei_fiscal_numeracao_overrides';

export const NUMERACAO_DOCUMENT_TYPES = Object.freeze(['nfse', 'nfe']);

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

const parsePositiveInt = (value, fallback = NaN) => {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (Number.isFinite(n) && n >= 1) return n;
  return fallback;
};

const normalizeDocumentType = (value) => {
  const type = String(value || '').trim().toLowerCase();
  return NUMERACAO_DOCUMENT_TYPES.includes(type) ? type : null;
};

/** A tabela pode não existir ainda em ambientes antigos — degrada sem quebrar a emissão. */
const warnAndIgnore = (operation, error) => {
  console.warn(`[fiscal-numeracao] ${operation} falhou`, error?.message || error);
};

const resolveKey = (cnpjInput, documentTypeInput) => {
  const cnpj = normalizeDoc(cnpjInput);
  const documentType = normalizeDocumentType(documentTypeInput);
  if (cnpj.length !== 14 || !documentType) return null;
  return { cnpj, documentType };
};

/**
 * Registra o próximo número que o usuário quer usar.
 * @param {() => import('@supabase/supabase-js').SupabaseClient} getDb
 * @param {{ cnpj: string, documentType: string, nextNumero: number, serie?: string|number|null, userId?: string|null }} input
 * @returns {Promise<boolean>} `false` quando não foi possível registrar.
 */
export async function setFiscalNumeracaoOverride(getDb, input = {}) {
  const key = resolveKey(input.cnpj, input.documentType);
  const nextNumero = parsePositiveInt(input.nextNumero, 0);
  if (!key || !nextNumero) return false;

  const serie = input.serie === undefined || input.serie === null
    ? null
    : String(input.serie).trim() || null;

  try {
    const { error } = await getDb()
      .from(TABLE)
      .upsert({
        cnpj: key.cnpj,
        document_type: key.documentType,
        next_numero: nextNumero,
        serie,
        requested_by: input.userId || null,
        created_at: new Date().toISOString(),
      }, { onConflict: 'cnpj,document_type' });
    if (error) throw new Error(error.message);
    return true;
  } catch (error) {
    warnAndIgnore('registrar numeração manual', error);
    return false;
  }
}

/**
 * @param {() => import('@supabase/supabase-js').SupabaseClient} getDb
 * @param {{ cnpj: string, documentType: string }} input
 * @returns {Promise<{ numero: number, serie: string|null }|null>}
 */
export async function readFiscalNumeracaoOverride(getDb, input = {}) {
  const key = resolveKey(input.cnpj, input.documentType);
  if (!key) return null;

  try {
    const { data, error } = await getDb()
      .from(TABLE)
      .select('next_numero, serie')
      .eq('cnpj', key.cnpj)
      .eq('document_type', key.documentType)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const numero = parsePositiveInt(data?.next_numero, 0);
    if (!numero) return null;
    return { numero, serie: data?.serie ?? null };
  } catch (error) {
    warnAndIgnore('ler numeração manual', error);
    return null;
  }
}

/**
 * Remove o override — chamado assim que o número é levado para a emissão.
 * @param {() => import('@supabase/supabase-js').SupabaseClient} getDb
 * @param {{ cnpj: string, documentType: string }} input
 */
export async function consumeFiscalNumeracaoOverride(getDb, input = {}) {
  const key = resolveKey(input.cnpj, input.documentType);
  if (!key) return;

  try {
    const { error } = await getDb()
      .from(TABLE)
      .delete()
      .eq('cnpj', key.cnpj)
      .eq('document_type', key.documentType);
    if (error) throw new Error(error.message);
  } catch (error) {
    warnAndIgnore('consumir numeração manual', error);
  }
}
