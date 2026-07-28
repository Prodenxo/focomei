import { createSupabaseClient } from '../config/supabase.js';

const TABLE = 'user_mei_certificates';

const emptyPrefill = () => ({
  prestadorCpfCnpj: null,
  prestadorRazaoSocial: null,
  prestadorEmail: null,
  prestadorInscricaoMunicipal: null,
  prestadorEndereco: null,
  sourceRowId: null,
});

const strField = (v) => {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  return String(v);
};

const onlyDigits = (value) => {
  if (value == null || value === '') return null;
  const d = String(value).replace(/\D/g, '');
  return d || null;
};

const normalizeCep = (value) => {
  const d = onlyDigits(value);
  return d && d.length <= 8 ? d.slice(0, 8) : d;
};

/**
 * Normaliza linha DB (schema novo/legado) → shape interno do mapper.
 * @param {Record<string, unknown>|null|undefined} raw
 */
export const normalizeUserMeiCertificateDbRow = (raw) => {
  if (raw == null || typeof raw !== 'object') return null;
  const id = raw.id;
  if (typeof id !== 'string') return null;
  return {
    id,
    cnpj: strField(raw.cnpj ?? raw.cert_document),
    razao_social: strField(raw.razao_social),
    email: strField(raw.email ?? raw.fiscal_email),
    inscricao_municipal: strField(raw.inscricao_municipal),
    logradouro: strField(raw.logradouro),
    numero: strField(raw.numero),
    complemento: strField(raw.complemento),
    bairro: strField(raw.bairro),
    codigo_ibge: strField(raw.codigo_ibge ?? raw.ibge_municipio),
    cep: strField(raw.cep),
    cidade: strField(raw.cidade),
    uf: strField(raw.uf),
  };
};

/**
 * @param {ReturnType<typeof normalizeUserMeiCertificateDbRow>} row
 */
export const mapUserMeiCertificateRowToNfsePrestadorDto = (row) => {
  if (!row) return emptyPrefill();

  const hasAnyAddress = Boolean(
    row.logradouro
    || row.numero
    || row.codigo_ibge
    || row.cep
    || row.complemento
    || row.bairro
    || row.cidade
    || row.uf,
  );

  const endereco = hasAnyAddress
    ? {
      logradouro: row.logradouro,
      numero: row.numero,
      codigoCidade: row.codigo_ibge,
      cep: normalizeCep(row.cep),
      complemento: row.complemento,
      bairro: row.bairro,
      estado: row.uf ? row.uf.trim().toUpperCase().slice(0, 2) || null : null,
      descricaoCidade: row.cidade,
    }
    : null;

  return {
    prestadorCpfCnpj: onlyDigits(row.cnpj),
    prestadorRazaoSocial: row.razao_social,
    prestadorEmail: row.email,
    prestadorInscricaoMunicipal: row.inscricao_municipal,
    prestadorEndereco: endereco,
    sourceRowId: row.id,
  };
};

const getSupabase = () => createSupabaseClient({ useServiceRole: true });

/**
 * Prefill do prestador NFS-e a partir de `user_mei_certificates` (sem PFX/senha).
 * @param {string} userId
 * @returns {Promise<{ prefill: ReturnType<typeof emptyPrefill> }>}
 */
export const getNfsePrestadorPrefill = async (userId) => {
  if (!userId) return { prefill: emptyPrefill() };

  const supabase = getSupabase();
  const { data: rows, error } = await supabase
    .from(TABLE)
    .select(`
      id,
      cert_document,
      razao_social,
      fiscal_email,
      inscricao_municipal,
      logradouro,
      numero,
      complemento,
      bairro,
      ibge_municipio,
      cep,
      cidade,
      uf,
      updated_at
    `)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) {
    console.warn('[mei-prestador-prefill] select failed:', error.message);
    return { prefill: emptyPrefill() };
  }

  const raw = Array.isArray(rows) ? rows[0] : rows;
  const row = normalizeUserMeiCertificateDbRow(raw);
  return { prefill: mapUserMeiCertificateRowToNfsePrestadorDto(row) };
};
