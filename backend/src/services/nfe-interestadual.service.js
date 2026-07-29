import { createSupabaseClient } from '../config/supabase.js';
import { badRequest } from '../utils/errors.js';

export const INTERESTADUAL_TERMS_VERSION = 'interestadual-terms-v2-mei-das';

export const INTERESTADUAL_DISCLAIMER_TEXT =
  'No MEI o imposto é o DAS mensal (valor fixo) — a NF-e não destaca ICMS sobre o valor da venda. '
  + 'Em venda para outro estado o sistema só ajusta o CFOP (6xxx) e mantém o CSOSN típico do MEI (ex.: 102). '
  + 'O FocoMEI não presta consultoria fiscal. Se o seu contador indicar outro enquadramento, alinhe com ele.';

export const INTERESTADUAL_CHECKBOX_TEXT =
  'Declaro que entendi: venda interestadual no MEI usa CFOP de outro estado, sem ICMS destacado na nota '
  + '(tributação pelo Simples/DAS). Assumo a responsabilidade pela correta emissão e pelo enquadramento fiscal.';

const CONSENT_TABLE = 'mei_nfe_interestadual_consent';
const TAXAS_TABLE = 'mei_nfe_interestadual_taxas';

const getAdmin = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada');
  }
  return createSupabaseClient({ useServiceRole: true });
};

export const normalizeUf = (value) => String(value || '').trim().toUpperCase().slice(0, 2);

export const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);

/**
 * CFOP interno (5xxx) → interestadual (6xxx). Fallback 6102.
 */
export const toInterestadualCfop = (cfopInterno) => {
  const c = onlyDigits(cfopInterno, 4);
  if (c.length !== 4) return '6102';
  if (c.startsWith('5')) return `6${c.slice(1)}`;
  if (c.startsWith('6')) return c;
  return '6102';
};

export const isInterestadualOperation = (emitenteUf, destinatarioUf) => {
  const origem = normalizeUf(emitenteUf);
  const destino = normalizeUf(destinatarioUf);
  if (!origem || origem.length !== 2) return false;
  if (!destino || destino.length !== 2) return false;
  return origem !== destino;
};

export const parseAliquotaIcms = (raw) => {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number'
    ? raw
    : Number(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 10000) / 10000;
};

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/**
 * CSOSN do Simples Nacional sem campos de cálculo (vBC/vICMS).
 * Ex.: 102 (MEI) — Plugnotas rejeita `valor` e `baseCalculo` escalar nesse CST.
 */
export const CSOSN_SEM_CALCULO_ICMS = new Set([
  '101',
  '102',
  '103',
  '300',
  '400',
  '500',
]);

/**
 * Aplica CFOP interestadual.
 * MEI/CSOSN 102: só CFOP 6xxx — sem ICMS destacado (DAS fixo).
 * CSOSN com cálculo (ex. 900): exige alíquota cadastrada.
 */
export const applyInterestadualTaxasToItem = (item, taxas, { forceCfop = true } = {}) => {
  if (!item || typeof item !== 'object') return item;

  const tributos = item.tributos && typeof item.tributos === 'object' ? { ...item.tributos } : {};
  const icmsPrev = tributos.icms && typeof tributos.icms === 'object' ? { ...tributos.icms } : {};
  const csosn = onlyDigits(taxas?.csosn || icmsPrev.csosn || icmsPrev.cst || '102', 3) || '102';
  const origem = String(icmsPrev.origem ?? '0').trim() || '0';
  const aliquota = parseAliquotaIcms(taxas?.aliquotaIcms ?? taxas?.aliquota_icms);

  const baseCfop = String(item.cfop || '5102');
  const cfop = forceCfop
    ? (onlyDigits(taxas?.cfop, 4) || toInterestadualCfop(baseCfop))
    : onlyDigits(baseCfop, 4);

  if (CSOSN_SEM_CALCULO_ICMS.has(csosn)) {
    return {
      ...item,
      cfop,
      tributos: {
        ...tributos,
        icms: { origem, cst: csosn },
      },
    };
  }

  if (aliquota === null) {
    throw badRequest('Informe a alíquota ICMS do estado de destino (0 a 100).', {
      code: 'NFE_INTERESTADUAL_TAX_REQUIRED',
      botHint:
        'Este CSOSN exige alíquota. Cadastre na app ou use CSOSN 102 (MEI / DAS sem ICMS na nota).',
    });
  }

  const valorItem = Number(
    item.valor
      ?? (
        Number(item.quantidade?.comercial ?? item.quantidade) || 0
      ) * (
        Number(item.valorUnitario?.comercial ?? item.valorUnitario) || 0
      ),
  );
  const baseCalculo = Number.isFinite(valorItem) && valorItem > 0 ? valorItem : 0;
  const valorIcms = roundMoney((baseCalculo * aliquota) / 100);

  return {
    ...item,
    cfop,
    tributos: {
      ...tributos,
      icms: {
        origem,
        cst: csosn,
        baseCalculo: { valor: roundMoney(baseCalculo) },
        aliquota,
        valor: valorIcms,
      },
    },
  };
};

export const getInterestadualConsent = async (userId) => {
  if (!userId) return null;
  const admin = getAdmin();
  const { data, error } = await admin
    .from(CONSENT_TABLE)
    .select('user_id, accepted_at, terms_version, ip_address, snapshot_json, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw badRequest(error.message);
  return data || null;
};

export const hasValidInterestadualConsent = async (userId) => {
  const row = await getInterestadualConsent(userId);
  if (!row?.accepted_at) return false;
  return String(row.terms_version || '') === INTERESTADUAL_TERMS_VERSION;
};

export const acceptInterestadualConsent = async (userId, {
  ipAddress = null,
  userAgent = null,
  snapshot = null,
  accepted = false,
} = {}) => {
  if (!userId) throw badRequest('Usuário obrigatório');
  if (!accepted) {
    throw badRequest('É obrigatório aceitar o termo de responsabilidade interestadual.', {
      code: 'NFE_INTERESTADUAL_CONSENT_REQUIRED',
    });
  }

  const now = new Date().toISOString();
  const row = {
    user_id: userId,
    accepted_at: now,
    terms_version: INTERESTADUAL_TERMS_VERSION,
    ip_address: ipAddress ? String(ipAddress).slice(0, 128) : null,
    user_agent: userAgent ? String(userAgent).slice(0, 512) : null,
    snapshot_json: snapshot && typeof snapshot === 'object' ? snapshot : {
      disclaimer: INTERESTADUAL_DISCLAIMER_TEXT,
      checkbox: INTERESTADUAL_CHECKBOX_TEXT,
      termsVersion: INTERESTADUAL_TERMS_VERSION,
    },
    updated_at: now,
  };

  const admin = getAdmin();
  const { data, error } = await admin
    .from(CONSENT_TABLE)
    .upsert(row, { onConflict: 'user_id' })
    .select('user_id, accepted_at, terms_version, ip_address, snapshot_json')
    .single();
  if (error) throw badRequest(error.message);
  return data;
};

export const listInterestadualTaxas = async (userId) => {
  if (!userId) return [];
  const admin = getAdmin();
  const { data, error } = await admin
    .from(TAXAS_TABLE)
    .select('uf_destino, aliquota_icms, csosn, cfop, metadata_json, updated_at')
    .eq('user_id', userId)
    .order('uf_destino', { ascending: true });
  if (error) throw badRequest(error.message);
  return (data || []).map((row) => ({
    ufDestino: row.uf_destino,
    aliquotaIcms: Number(row.aliquota_icms),
    csosn: row.csosn || null,
    cfop: row.cfop || null,
    metadata: row.metadata_json || null,
    updatedAt: row.updated_at,
  }));
};

export const getInterestadualTaxasForUf = async (userId, ufDestino) => {
  const uf = normalizeUf(ufDestino);
  if (!userId || uf.length !== 2) return null;
  const admin = getAdmin();
  const { data, error } = await admin
    .from(TAXAS_TABLE)
    .select('uf_destino, aliquota_icms, csosn, cfop, metadata_json, updated_at')
    .eq('user_id', userId)
    .eq('uf_destino', uf)
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data) return null;
  return {
    ufDestino: data.uf_destino,
    aliquotaIcms: Number(data.aliquota_icms),
    csosn: data.csosn || null,
    cfop: data.cfop || null,
    metadata: data.metadata_json || null,
    updatedAt: data.updated_at,
  };
};

export const upsertInterestadualTaxas = async (userId, payload = {}) => {
  if (!userId) throw badRequest('Usuário obrigatório');
  const uf = normalizeUf(payload.ufDestino ?? payload.uf_destino ?? payload.uf);
  if (uf.length !== 2) {
    throw badRequest('Informe a UF de destino (2 letras).', {
      code: 'NFE_INTERESTADUAL_UF_REQUIRED',
    });
  }
  const aliquota = parseAliquotaIcms(payload.aliquotaIcms ?? payload.aliquota_icms ?? payload.aliquota);
  if (aliquota === null) {
    throw badRequest('Informe a alíquota ICMS do estado de destino (0 a 100).', {
      code: 'NFE_INTERESTADUAL_TAX_REQUIRED',
    });
  }
  const csosnRaw = onlyDigits(payload.csosn ?? payload.icmsCsosn, 3);
  const cfopRaw = onlyDigits(payload.cfop, 4);
  const now = new Date().toISOString();
  const row = {
    user_id: userId,
    uf_destino: uf,
    aliquota_icms: aliquota,
    csosn: csosnRaw || null,
    cfop: cfopRaw || null,
    metadata_json: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : null,
    updated_at: now,
  };

  const admin = getAdmin();
  const { data, error } = await admin
    .from(TAXAS_TABLE)
    .upsert(row, { onConflict: 'user_id,uf_destino' })
    .select('uf_destino, aliquota_icms, csosn, cfop, metadata_json, updated_at')
    .single();
  if (error) throw badRequest(error.message);
  return {
    ufDestino: data.uf_destino,
    aliquotaIcms: Number(data.aliquota_icms),
    csosn: data.csosn || null,
    cfop: data.cfop || null,
    metadata: data.metadata_json || null,
    updatedAt: data.updated_at,
  };
};

/**
 * Garante consent MEI interestadual. Taxas ICMS são opcionais (MEI/DAS = sem ICMS na nota).
 * Operação interna (mesma UF): retorna { interestadual: false }.
 */
export const resolveInterestadualForNfeEmit = async (userId, {
  emitenteUf,
  destinatarioUf,
  skipEnforce = false,
} = {}) => {
  const origem = normalizeUf(emitenteUf);
  const destino = normalizeUf(destinatarioUf);

  if (!destino || destino.length !== 2) {
    throw badRequest(
      'Para emitir NF-e informe o estado (UF) completo do cliente no endereço.',
      {
        code: 'NFE_DESTINATARIO_UF_REQUIRED',
        botHint: 'Cadastre o cliente com endereço e UF antes de emitir.',
      },
    );
  }

  if (!origem || origem.length !== 2) {
    throw badRequest('Estado (UF) da sua empresa não está cadastrado.', {
      code: 'NFE_EMITENTE_UF_REQUIRED',
      botHint: 'Complete o endereço da empresa / certificado na app.',
    });
  }

  if (origem === destino) {
    return { interestadual: false, emitenteUf: origem, destinatarioUf: destino };
  }

  if (skipEnforce) {
    return { interestadual: true, emitenteUf: origem, destinatarioUf: destino, taxas: null };
  }

  const okConsent = await hasValidInterestadualConsent(userId);
  if (!okConsent) {
    throw badRequest(
      'Para vender para outro estado, confirme o aviso de NF-e interestadual MEI na app.',
      {
        code: 'NFE_INTERESTADUAL_CONSENT_REQUIRED',
        botHint:
          'Abra a emissão NF-e na app FocoMEI, aceite o aviso (DAS fixo / sem ICMS na nota) e tente de novo.',
        termsVersion: INTERESTADUAL_TERMS_VERSION,
        ufDestino: destino,
      },
    );
  }

  // Taxas opcionais: usadas só se o item tiver CSOSN com cálculo (ex. 900).
  const taxas = await getInterestadualTaxasForUf(userId, destino);

  return {
    interestadual: true,
    emitenteUf: origem,
    destinatarioUf: destino,
    taxas: taxas || { ufDestino: destino, aliquotaIcms: null, csosn: null, cfop: null },
  };
};

/**
 * Ajusta payload NF-e PlugNotas (itens) quando interestadual.
 */
export const applyInterestadualToNfePayload = async (userId, payload, {
  emitenteUf,
  destinatarioUf,
} = {}) => {
  const resolved = await resolveInterestadualForNfeEmit(userId, {
    emitenteUf,
    destinatarioUf: destinatarioUf
      || payload?.destinatario?.endereco?.estado
      || payload?.destinatario?.endereco?.uf,
  });

  if (!resolved.interestadual) {
    return { payload, interestadual: false, resolved };
  }

  const itens = Array.isArray(payload?.itens) ? payload.itens : [];
  const nextItens = itens.map((item) => applyInterestadualTaxasToItem(item, resolved.taxas));

  return {
    payload: { ...payload, itens: nextItens },
    interestadual: true,
    resolved,
  };
};
