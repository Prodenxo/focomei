import { badRequest } from '../../utils/errors.js';
import { unwrapPlugnotasEmpresaRecord } from '../mei-emitente-empresa-sync.js';
import {
  consultarEmpresaPlugNotas,
  ensureMeiRegimeEspecialPlugnotasEmpresa,
  patchEmpresaPlugnotasDirect,
} from './empresa.service.js';
import {
  PLUGNOTAS_MEI_INSCRICAO_ESTADUAL_QUANDO_VAZIA,
  PLUGNOTAS_REGIME_ESPECIAL_MEI,
} from './plugnotas-mei-empresa-policy.js';

/** Literal ISENTO no cadastro Plugnotas — omitido no XML de emissão (bug/comportamento da API). */
export const PLUGNOTAS_NFE_IE_ISENTO_LITERAL = PLUGNOTAS_MEI_INSCRICAO_ESTADUAL_QUANDO_VAZIA;

export const PLUGNOTAS_NFE_IE_ISENTO_XML_ERROR = (
  'Para emitir NF-e de produto, informe sua Inscrição Estadual numérica no emitente '
  + '(somente dígitos). A Plugnotas não inclui a tag IE no XML quando o valor é ISENTO, '
  + 'o que causa rejeição de schema (CRT antes de IE). Consulte o Sintegra do seu estado '
  + 'ou seu contador.'
);

export const isPlugnotasNfeEmitenteIeIsentoLiteral = (ie) => (
  String(ie ?? '').trim().toUpperCase() === PLUGNOTAS_NFE_IE_ISENTO_LITERAL
);

/** IE que a Plugnotas de fato serializa como `<IE>` no XML (confirmado em homologação). */
export const isPlugnotasNfeEmitenteIeNumericForXml = (ie) => {
  const raw = String(ie ?? '').trim();
  if (!raw || isPlugnotasNfeEmitenteIeIsentoLiteral(raw)) return false;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 2;
};

/**
 * Resolve IE numérica para o JSON de emissão NF-e (emitente → cadastro Plugnotas).
 * @param {Record<string, unknown>|null|undefined} emitente
 * @param {Record<string, unknown>|null|undefined} empresa
 * @returns {string|null}
 */
export const resolvePlugnotasNfeEmitenteInscricaoEstadualForXml = (emitente, empresa) => {
  const candidates = [
    emitente?.inscricaoEstadual,
    empresa?.inscricaoEstadual,
  ];
  for (const candidate of candidates) {
    if (isPlugnotasNfeEmitenteIeNumericForXml(candidate)) {
      return String(candidate).trim().replace(/\D/g, '');
    }
  }
  return null;
};

export const isPlugnotasNfeSchemaRejectionMissingEmitenteIe = (message) => {
  const text = String(message || '');
  return text.includes('CRT')
    && text.includes('IE')
    && (text.includes('Invalid content') || text.includes('cvc-complex-type'));
};

/** CRT MEI na NF-e (NT 2024.001). */
export const PLUGNOTAS_CRT_MEI = 4;

/** Esquema XML mínimo com CRT 4 (legado). */
export const PLUGNOTAS_NFE_VERSAO_ESQUEMA_MEI = 'pl_010c';

/** Versões aceitas no cadastro Plugnotas — não fazer downgrade. */
export const PLUGNOTAS_NFE_VERSAO_ESQUEMA_ACCEPTED = new Set([
  PLUGNOTAS_NFE_VERSAO_ESQUEMA_MEI,
  'pl_010e',
]);

const toObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

export const isMeiNfeEmitForceEnabled = () => {
  const raw = String(process.env.MEI_NFE_FORCE_CRT_EMIT ?? 'true').trim().toLowerCase();
  return ['1', 'true', 'yes', 'sim'].includes(raw);
};

export const empresaPrecisaInscricaoEstadualPlugnotas = (empresa) => (
  !String(empresa?.inscricaoEstadual ?? '').trim()
);

export const empresaPrecisaRegimeMeiPlugnotas = (empresa) => {
  if (!empresa || typeof empresa !== 'object') return true;
  const especial = Number(empresa.regimeTributarioEspecial);
  const regime = Number(empresa.regimeTributario);
  if (especial !== PLUGNOTAS_REGIME_ESPECIAL_MEI) return true;
  if (regime !== 1) return true;
  if (empresa.simplesNacional === false) return true;
  return false;
};

const empresaPrecisaVersaoEsquemaMei = (empresa) => {
  const versao = String(empresa?.nfe?.config?.versaoEsquema || '').trim();
  if (!versao) return true;
  return !PLUGNOTAS_NFE_VERSAO_ESQUEMA_ACCEPTED.has(versao);
};

/**
 * Monta PATCHs mínimos no cadastro Plugnotas antes da NF-e.
 * A Plugnotas monta `<IE>` no XML a partir do cadastro da empresa — não só do JSON de emissão.
 * @param {Record<string, unknown>|null|undefined} empresa
 * @param {string} cnpj14
 */
export const buildMeiNfePreEmitEmpresaPatches = (empresa, cnpj14) => {
  const cnpj = normalizeDoc(cnpj14);
  /** @type {Record<string, unknown>[]} */
  const patches = [];

  if (empresaPrecisaInscricaoEstadualPlugnotas(empresa)) {
    patches.push({
      cpfCnpj: cnpj,
      inscricaoEstadual: PLUGNOTAS_MEI_INSCRICAO_ESTADUAL_QUANDO_VAZIA,
    });
  }

  if (empresaPrecisaVersaoEsquemaMei(empresa)) {
    const nfe = toObject(empresa?.nfe);
    const config = toObject(nfe.config);
    const configPatch = { ...config, versaoEsquema: PLUGNOTAS_NFE_VERSAO_ESQUEMA_MEI };
    delete configPatch.numeracao;
    patches.push({
      cpfCnpj: cnpj,
      nfe: {
        ativo: true,
        tipoContrato: nfe.tipoContrato ?? 0,
        config: configPatch,
      },
    });
  }

  if (empresaPrecisaRegimeMeiPlugnotas(empresa)) {
    patches.push({
      cpfCnpj: cnpj,
      regimeTributario: 1,
      regimeTributarioEspecial: PLUGNOTAS_REGIME_ESPECIAL_MEI,
      simplesNacional: true,
    });
  }

  return patches;
};

/** @deprecated Use buildMeiNfePreEmitEmpresaPatches */
export const buildMeiNfePreEmitEmpresaPatch = (empresa, cnpj14) => {
  const patches = buildMeiNfePreEmitEmpresaPatches(empresa, cnpj14);
  if (!patches.length) {
    return { needsPatch: false, patch: null };
  }
  return { needsPatch: true, patch: patches[0] };
};

/**
 * Best-effort: IE + regime MEI + versaoEsquema pl_010c no cadastro Plugnotas antes da NF-e.
 * @param {string} cnpjInput
 * @returns {Promise<Record<string, unknown>|null>}
 */
export const ensureMeiNfePlugnotasCadastroBeforeEmit = async (cnpjInput) => {
  const cnpj = normalizeDoc(cnpjInput);
  if (cnpj.length !== 14) return null;

  try {
    await ensureMeiRegimeEspecialPlugnotasEmpresa(cnpj);
  } catch (error) {
    console.warn('[plugnotas] falha ao garantir regime MEI antes da NF-e', {
      cnpj14: `${cnpj.slice(0, 4)}***${cnpj.slice(-2)}`,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  let empresaJson;
  try {
    empresaJson = await consultarEmpresaPlugNotas(cnpj);
  } catch {
    return null;
  }

  let empresa = unwrapPlugnotasEmpresaRecord(empresaJson) || {};
  const patches = buildMeiNfePreEmitEmpresaPatches(empresa, cnpj);
  if (!patches.length) {
    return empresa;
  }

  for (const patch of patches) {
    try {
      const result = await patchEmpresaPlugnotasDirect(cnpj, patch);
      if (!result.response) {
        const errorMessage = result.lastError instanceof Error
          ? result.lastError.message
          : String(result.lastError || '');
        console.warn('[plugnotas] falha ao ajustar cadastro MEI antes da NF-e', {
          cnpj14: `${cnpj.slice(0, 4)}***${cnpj.slice(-2)}`,
          patchKeys: Object.keys(patch),
          error: errorMessage,
        });
      }
    } catch (error) {
      console.warn('[plugnotas] falha ao ajustar cadastro MEI antes da NF-e', {
        cnpj14: `${cnpj.slice(0, 4)}***${cnpj.slice(-2)}`,
        patchKeys: Object.keys(patch),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    empresa = unwrapPlugnotasEmpresaRecord(await consultarEmpresaPlugNotas(cnpj)) || empresa;
  } catch {
    // mantém último snapshot conhecido
  }
  return empresa;
};

/**
 * Preenche IE do emitente a partir do cadastro Plugnotas quando o payload não trouxe.
 * @param {Record<string, unknown>} payload
 * @param {Record<string, unknown>|null|undefined} empresa
 */
export const hydrateMeiNfeEmitenteIeFromEmpresa = (payload, empresa) => {
  if (!payload || typeof payload !== 'object') return payload;
  const emitente = toObject(payload.emitente);
  if (isPlugnotasNfeEmitenteIeNumericForXml(emitente.inscricaoEstadual)) {
    return payload;
  }

  const empresaIe = resolvePlugnotasNfeEmitenteInscricaoEstadualForXml(null, empresa);
  if (!empresaIe) return payload;

  return {
    ...payload,
    emitente: {
      ...emitente,
      inscricaoEstadual: empresaIe,
    },
  };
};

/**
 * Garante IE numérica no emitente — Plugnotas omite `<IE>` quando o valor é ISENTO.
 * @param {Record<string, unknown>} payload
 */
export const ensureEmitenteInscricaoEstadualOnNfePayload = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  const emitente = toObject(payload.emitente);
  const ieEmitente = resolvePlugnotasNfeEmitenteInscricaoEstadualForXml(emitente, null);
  if (!ieEmitente) return payload;
  return {
    ...payload,
    emitente: {
      ...emitente,
      inscricaoEstadual: ieEmitente,
    },
  };
};

/**
 * Valida e aplica IE numérica no JSON de emissão NF-e antes de chamar a Plugnotas.
 * @param {Record<string, unknown>} payload
 * @param {Record<string, unknown>|null|undefined} empresa
 * @returns {Record<string, unknown>}
 */
export const applyPlugnotasNfeEmitenteIeForXml = (payload, empresa) => {
  if (!payload || typeof payload !== 'object') return payload;
  const emitente = toObject(payload.emitente);
  const ieNumeric = resolvePlugnotasNfeEmitenteInscricaoEstadualForXml(emitente, empresa);
  if (!ieNumeric) {
    throw badRequest(PLUGNOTAS_NFE_IE_ISENTO_XML_ERROR);
  }
  return {
    ...payload,
    emitente: {
      ...emitente,
      inscricaoEstadual: ieNumeric,
    },
  };
};

/**
 * Sincroniza IE numérica informada na emissão para o cadastro Plugnotas (best-effort).
 * @param {string} cnpjInput
 * @param {string} ieNumeric
 * @param {Record<string, unknown>|null|undefined} empresa
 */
export const syncNumericIeToPlugnotasCadastroIfNeeded = async (cnpjInput, ieNumeric, empresa) => {
  const cnpj = normalizeDoc(cnpjInput);
  const ie = String(ieNumeric || '').replace(/\D/g, '');
  if (cnpj.length !== 14 || ie.length < 2) return;

  const cadastroIe = String(empresa?.inscricaoEstadual || '').trim();
  if (cadastroIe === ie) return;
  if (isPlugnotasNfeEmitenteIeNumericForXml(cadastroIe)) return;

  try {
    await patchEmpresaPlugnotasDirect(cnpj, {
      cpfCnpj: cnpj,
      inscricaoEstadual: ie,
    });
  } catch (error) {
    console.warn('[plugnotas] falha ao sincronizar IE numérica no cadastro antes da NF-e', {
      cnpj14: `${cnpj.slice(0, 4)}***${cnpj.slice(-2)}`,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Alinha `config.producao` com o cadastro NF-e na Plugnotas (homologação vs produção).
 * @param {Record<string, unknown>} payload
 * @param {Record<string, unknown>|null|undefined} empresa
 */
export const applyMeiNfeEmitConfigFromEmpresa = (payload, empresa) => {
  if (!payload || typeof payload !== 'object') return payload;
  const nfeConfig = toObject(empresa?.nfe?.config);
  const config = toObject(payload.config);
  const nextConfig = { ...config };
  let changed = false;
  if (typeof nfeConfig.producao === 'boolean' && nextConfig.producao !== nfeConfig.producao) {
    nextConfig.producao = nfeConfig.producao;
    changed = true;
  }
  const versaoCadastro = String(nfeConfig.versaoEsquema || '').trim();
  if (versaoCadastro && nextConfig.versaoEsquema !== versaoCadastro) {
    nextConfig.versaoEsquema = versaoCadastro;
    changed = true;
  }
  if (!changed) return payload;
  return { ...payload, config: nextConfig };
};

/**
 * Garante IE no emitente, CRT 4 (MEI) quando há IE numérica, e versaoEsquema pl_010c.
 * @param {Record<string, unknown>} payload
 */
export const applyMeiNfeEmitForcePolicy = (payload) => {
  const withIe = ensureEmitenteInscricaoEstadualOnNfePayload(payload);
  if (!isMeiNfeEmitForceEnabled() || !withIe || typeof withIe !== 'object') {
    return withIe;
  }

  const config = toObject(withIe.config);
  const { crt, emitente, ...rest } = withIe;
  const emitenteClean = toObject(emitente);
  if (isPlugnotasNfeEmitenteIeNumericForXml(emitenteClean.inscricaoEstadual)) {
    emitenteClean.crt = PLUGNOTAS_CRT_MEI;
  } else {
    delete emitenteClean.crt;
  }

  return {
    ...rest,
    emitente: emitenteClean,
    config: {
      ...config,
      versaoEsquema: String(config.versaoEsquema || '').trim()
        || PLUGNOTAS_NFE_VERSAO_ESQUEMA_MEI,
    },
  };
};
