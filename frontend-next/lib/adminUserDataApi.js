import { apiClient, EMIT_FETCH_TIMEOUT_MS } from '@/lib/apiClient';

const encode = encodeURIComponent;
const withQuery = (path, values = {}) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      params.set(key, String(value).trim());
    }
  });
  return `${path}${params.size ? `?${params.toString()}` : ''}`;
};

export function fetchAdminMeiCertificateStatus(userId) {
  return apiClient.get(`/admin/mei-guide/${encode(userId)}/certificate/status`);
}

export async function fetchAdminMeiPeriods(userId, cnpj) {
  const result = await apiClient.get(
    withQuery(`/admin/mei-guide/${encode(userId)}/periods`, { cnpj }),
  );
  return Array.isArray(result) ? result : [];
}

export async function fetchAdminParcelamentos(userId, cnpj) {
  return apiClient.get(
    withQuery(`/admin/mei-guide/${encode(userId)}/parcelamentos`, { cnpj }),
    { timeoutMs: 30000 },
  );
}

export async function fetchAdminNotas(userId) {
  const result = await apiClient.get(
    withQuery(`/admin/users/${encode(userId)}/mei-nfse`, {
      includeArchived: 'true',
      limit: 50,
    }),
  );
  return Array.isArray(result) ? result : [];
}

export function downloadAdminMeiGuide(userId, periodoApuracao, cnpj) {
  return apiClient.download(
    withQuery(
      `/admin/mei-guide/${encode(userId)}/download/${encode(periodoApuracao)}`,
      { cnpj },
    ),
    { timeoutMs: 30000 },
  );
}

export function downloadAdminParcelamentoPdf(userId, numero, options = {}) {
  return apiClient.download(
    withQuery(
      `/admin/mei-guide/${encode(userId)}/parcelamentos/${encode(numero)}/pdf`,
      options,
    ),
    { timeoutMs: 30000 },
  );
}

export function sendAdminMeiGuideWhatsapp(userId, periodoApuracao, cnpj) {
  return apiClient.post(
    `/admin/mei-guide/${encode(userId)}/send-whatsapp`,
    { periodoApuracao, cnpj },
    { timeoutMs: 30000 },
  );
}

export function fetchAdminNfsePrestadorPrefill(userId) {
  return apiClient.get(`/admin/mei-guide/${encode(userId)}/prestador-prefill`);
}

export function emitirNotaAsAdmin(userId, input) {
  return apiClient.post(
    `/admin/users/${encode(userId)}/mei-nfse/emitir`,
    input,
    { timeoutMs: EMIT_FETCH_TIMEOUT_MS },
  );
}
