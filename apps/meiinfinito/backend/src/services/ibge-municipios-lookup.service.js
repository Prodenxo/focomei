import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeIbgeMunicipioCodigo } from '../utils/ibge-municipio-codigo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_JSON_PATH = path.resolve(__dirname, '../../data/municipios.json');

/** @type {Map<string, string>|null} */
let municipioIndex = null;

/**
 * Chave de busca: nome do município sem acento + UF (ex.: `rio de janeiro|RJ`).
 * @param {unknown} name
 * @param {unknown} uf
 * @returns {string}
 */
export const normalizeMunicipioLookupKey = (name, uf) => {
  const city = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const state = String(uf || '').trim().toUpperCase().slice(0, 2);
  if (!city || state.length !== 2) return '';
  return `${city}|${state}`;
};

const padIbge7 = (value) => {
  const digits = normalizeIbgeMunicipioCodigo(value);
  if (digits.length < 6 || digits.length > 7) return '';
  return digits.padStart(7, '0').slice(-7);
};

const indexFromEntry = (index, nome, uf, ibgeCode) => {
  const key = normalizeMunicipioLookupKey(nome, uf);
  if (key) index.set(key, ibgeCode);
};

const buildIndexFromJson = (filePath) => {
  const raw = JSON.parse(readFileSync(filePath, 'utf8'));
  const rows = Array.isArray(raw?.municipios) ? raw.municipios : [];
  const index = new Map();

  for (const row of rows) {
    const ibgeCode = padIbge7(row?.ibge);
    const uf = String(row?.uf || '').trim().toUpperCase().slice(0, 2);
    if (!ibgeCode || uf.length !== 2) continue;

    indexFromEntry(index, row?.nomeIbge, uf, ibgeCode);
    indexFromEntry(index, row?.nomeTom, uf, ibgeCode);
  }

  return index;
};

const resolveJsonPath = () => {
  const fromEnv = String(process.env.MUNICIPIOS_JSON_PATH || '').trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_JSON_PATH;
};

const loadMunicipioIndex = () => {
  if (municipioIndex) return municipioIndex;

  const jsonPath = resolveJsonPath();
  if (!existsSync(jsonPath)) {
    municipioIndex = new Map();
    return municipioIndex;
  }

  municipioIndex = buildIndexFromJson(jsonPath);
  return municipioIndex;
};

/** Limpa cache em memória (testes). */
export const resetIbgeMunicipiosLookupCache = () => {
  municipioIndex = null;
};

/**
 * Resolve código IBGE (7 dígitos) a partir do nome do município e UF.
 * Fonte: `backend/data/municipios.json` (TOM/IBGE Plugnotas).
 * @param {unknown} cidade
 * @param {unknown} uf
 * @returns {string|null}
 */
export const resolveIbgeCodigoFromMunicipio = (cidade, uf) => {
  const key = normalizeMunicipioLookupKey(cidade, uf);
  if (!key) return null;
  const ibge = loadMunicipioIndex().get(key);
  return ibge || null;
};
