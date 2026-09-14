import { applyEmpresaPlugnotasNfseConfigRps } from './plugnotas-empresa-rps-inicial.js';

/**
 * Política MEI / Guia MEI — cadastro empresa Plugnotas (apenas NFS-e).
 * @see docs/adr/ADR-plugnotas-empresa-payload-apenas-nfse.md
 * @see docs/stories/epic-guia-mei-apenas-nfse-prd.md (US-MEI-NFS-01)
 */
export const PLUGNOTAS_MEI_INSCRICAO_ESTADUAL_QUANDO_VAZIA = 'ISENTO';

/**
 * Contrato oficial NFS-e Nacional no `POST/PATCH` empresa.
 * Política MVP: `consultaNfseNacional` acompanha `nfseNacional`.
 * @see docs/adr/ADR-plugnotas-nfse-nacional-empresa-spike.md
 */
export const PLUGNOTAS_NFSE_CONFIG_NACIONAL_KEY = 'nfseNacional';
export const PLUGNOTAS_NFSE_CONFIG_CONSULTA_NACIONAL_KEY = 'consultaNfseNacional';
export const PLUGNOTAS_NFSE_NACIONAL_LEGACY_INPUT_KEY = 'nacional';
export const PLUGNOTAS_NFSE_NACIONAL_DEFAULT_ON = true;

const hasOwn = (value, key) =>
  Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toObject = (value) => (isPlainObject(value) ? value : {});

export const inspectNfseContractInput = (nfseRaw) => {
  const nfse = toObject(nfseRaw);
  const config = toObject(nfse.config);
  const hasOfficialContractInput =
    hasOwn(config, PLUGNOTAS_NFSE_CONFIG_NACIONAL_KEY)
    || hasOwn(config, PLUGNOTAS_NFSE_CONFIG_CONSULTA_NACIONAL_KEY);
  const hasLegacyNationalInput = hasOwn(nfse, PLUGNOTAS_NFSE_NACIONAL_LEGACY_INPUT_KEY);

  return {
    hasOfficialContractInput,
    hasLegacyNationalInput,
    usesLegacyOnlyNationalInput: hasLegacyNationalInput && !hasOfficialContractInput
  };
};

export const applyNfseNationalContractPolicy = (payload) => {
  if (!isPlainObject(payload)) return inspectNfseContractInput(null);

  const nfse = toObject(payload.nfse);
  const contractInput = inspectNfseContractInput(nfse);
  if (!Object.keys(nfse).length) return contractInput;

  const next = { ...nfse };
  const nextConfig = toObject(next.config);
  delete next[PLUGNOTAS_NFSE_NACIONAL_LEGACY_INPUT_KEY];

  if (next.ativo === false) {
    delete nextConfig[PLUGNOTAS_NFSE_CONFIG_NACIONAL_KEY];
    delete nextConfig[PLUGNOTAS_NFSE_CONFIG_CONSULTA_NACIONAL_KEY];
    if (Object.keys(nextConfig).length) next.config = nextConfig;
    else delete next.config;
    payload.nfse = next;
    return contractInput;
  }

  const configWithDefaults = {
    producao: true,
    ...nextConfig,
    [PLUGNOTAS_NFSE_CONFIG_NACIONAL_KEY]: PLUGNOTAS_NFSE_NACIONAL_DEFAULT_ON,
    [PLUGNOTAS_NFSE_CONFIG_CONSULTA_NACIONAL_KEY]: PLUGNOTAS_NFSE_NACIONAL_DEFAULT_ON
  };

  next.config = configWithDefaults;
  payload.nfse = next;
  applyEmpresaPlugnotasNfseConfigRps(payload);
  return contractInput;
};

/** Código Plugnotas para regime tributário especial MEI (cadastro empresa). */
export const PLUGNOTAS_REGIME_ESPECIAL_MEI = 5;

/**
 * Regime MEI no cadastro Plugnotas: o valor 5 é o que gera `<CRT>4</CRT>` no XML da NF-e
 * (NT 2024.001). Enviar 4 aqui produz `<CRT>3</CRT>` e a SEFAZ rejeita com a 481.
 */
export const PLUGNOTAS_REGIME_TRIBUTARIO_MEI = 5;

/** Regimes aceitos para MEI: 1 (Simples) e 5 (MEI) — 5 é obrigatório na NF-e. */
export const isPlugnotasRegimeTributarioMeiCompativel = (value) => {
  const regime = Number(value);
  return regime === 1 || regime === PLUGNOTAS_REGIME_TRIBUTARIO_MEI;
};

/**
 * Garante payload MEI na Plugnotas: regimeTributario 1 ou 5 + regimeTributarioEspecial 5.
 * @param {Record<string, unknown>} payload
 */
export const normalizeMeiEmpresaPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  let regime = Number(payload.regimeTributario);
  const especial = Number(payload.regimeTributarioEspecial);

  /** CRT 4 (código da SEFAZ) equivale ao regime 5 no cadastro Plugnotas. */
  if (regime === 4 || regime === PLUGNOTAS_REGIME_TRIBUTARIO_MEI) {
    payload.regimeTributario = PLUGNOTAS_REGIME_TRIBUTARIO_MEI;
    payload.regimeTributarioEspecial = PLUGNOTAS_REGIME_ESPECIAL_MEI;
    payload.simplesNacional = true;
    return payload;
  }

  // Mei Infinito: cadastro sem regime explícito assume Simples Nacional (1).
  if (!Number.isFinite(regime) || regime <= 0) {
    payload.regimeTributario = 1;
    regime = 1;
  }

  if (payload.simplesNacional !== false) {
    payload.simplesNacional = true;
  }

  if (regime === 1 && (Number.isNaN(especial) || especial === 0)) {
    payload.regimeTributarioEspecial = PLUGNOTAS_REGIME_ESPECIAL_MEI;
  }

  return payload;
};

/**
 * Payload mínimo para PATCH do regime MEI (1 + especial 5) na Plugnotas.
 * @param {string} cnpj14
 * @param {string} [certificadoId]
 */
export const buildMeiRegimePatchPayload = (cnpj14, certificadoId, opts = {}) => {
  const preserveIe = opts.preserveInscricaoEstadual === true;
  const payload = {
    cpfCnpj: cnpj14,
    regimeTributario: 1,
    simplesNacional: true,
    regimeTributarioEspecial: PLUGNOTAS_REGIME_ESPECIAL_MEI,
    ...(preserveIe ? {} : { inscricaoEstadual: PLUGNOTAS_MEI_INSCRICAO_ESTADUAL_QUANDO_VAZIA }),
  };
  const cert = certificadoId != null ? String(certificadoId).trim() : '';
  if (cert) payload.certificado = cert;
  normalizeMeiEmpresaPayload(payload);
  return payload;
};

/**
 * Modo municipal guiado — FR-ALNFB-06 (retry com `nfseNacional=false`).
 * @param {Record<string, unknown>} payload
 */
export const applyNfseMunicipalContractPolicy = (payload) => {
  if (!isPlainObject(payload)) return inspectNfseContractInput(null);

  const nfse = toObject(payload.nfse);
  const contractInput = inspectNfseContractInput(nfse);
  if (!Object.keys(nfse).length) return contractInput;

  const next = { ...nfse };
  const nextConfig = toObject(next.config);
  delete next[PLUGNOTAS_NFSE_NACIONAL_LEGACY_INPUT_KEY];

  if (next.ativo === false) {
    delete nextConfig[PLUGNOTAS_NFSE_CONFIG_NACIONAL_KEY];
    delete nextConfig[PLUGNOTAS_NFSE_CONFIG_CONSULTA_NACIONAL_KEY];
    if (Object.keys(nextConfig).length) next.config = nextConfig;
    else delete next.config;
    payload.nfse = next;
    return contractInput;
  }

  next.config = {
    producao: true,
    ...nextConfig,
    [PLUGNOTAS_NFSE_CONFIG_NACIONAL_KEY]: false,
    [PLUGNOTAS_NFSE_CONFIG_CONSULTA_NACIONAL_KEY]: false
  };
  payload.nfse = next;
  applyEmpresaPlugnotasNfseConfigRps(payload);
  return contractInput;
};
