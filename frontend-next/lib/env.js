/**
 * Ambiente do app novo. Aceita as mesmas variáveis do app Expo quando injetadas
 * em runtime por `/env-config.js` (Docker/EasyPanel), para não duplicar configuração.
 */

const RUNTIME_GLOBAL = '__MEU_FINANCEIRO_ENV__';

const DEFAULT_API_URL = 'http://localhost:3333';
const DEFAULT_LEGACY_WEB_URL = 'http://localhost:8081';

function readRuntime(key) {
  if (typeof window === 'undefined') return '';
  const value = window[RUNTIME_GLOBAL]?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

/** Base do backend, sem o sufixo `/api`. */
export function getApiBaseUrl() {
  const fromRuntime = readRuntime('EXPO_PUBLIC_MEI_API_URL');
  const fromBuild = process.env.NEXT_PUBLIC_MEI_API_URL;
  return stripTrailingSlash(fromRuntime || fromBuild || DEFAULT_API_URL);
}

/** Origem do app Expo atual — destino dos links de menu e do login. */
export function getLegacyWebUrl() {
  const fromBuild = process.env.NEXT_PUBLIC_LEGACY_WEB_URL;
  return stripTrailingSlash(fromBuild || DEFAULT_LEGACY_WEB_URL);
}

/** Monta uma URL de tela do app antigo (ex.: `/transacoes`). */
export function legacyHref(path) {
  const suffix = String(path || '/');
  return `${getLegacyWebUrl()}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}
