import { apiClient } from '@/lib/apiClient';

function findAccessToken(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.access_token === 'string') return value.access_token;
  for (const child of Object.values(value)) {
    const token = findAccessToken(child);
    if (token) return token;
  }
  return null;
}

async function invokeEdge(body) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || typeof window === 'undefined') {
    throw new Error('Integração de solicitações não configurada.');
  }
  const stored = window.localStorage.getItem('financas-pessoais-auth');
  const token = findAccessToken(stored ? JSON.parse(stored) : null);
  if (!token) throw new Error('Sessão administrativa expirada.');
  const response = await fetch(`${url.replace(/\/$/, '')}/functions/v1/manage-access-requests`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data?.error || 'Falha ao gerir solicitação.');
  return data;
}

export async function listPendingAccessRequests() {
  let data;
  try {
    data = await apiClient.get('/admin/access-requests/pending');
  } catch (error) {
    if (error?.status !== 404) throw error;
    data = await invokeEdge({ action: 'list' });
  }
  return Array.isArray(data?.requests) ? data.requests : [];
}

export async function fetchAccessReport(limit = 50) {
  let data;
  try {
    data = await apiClient.get(`/admin/access-requests/report?limit=${limit}`);
  } catch (error) {
    if (error?.status !== 404) throw error;
    data = await invokeEdge({ action: 'report', limit });
  }
  return Array.isArray(data?.entries) ? data.entries : [];
}

export async function manageAccessRequest(action, userId) {
  try {
    return await apiClient.post('/admin/access-requests/manage', { action, userId });
  } catch (error) {
    if (error?.status !== 404) throw error;
    return invokeEdge({ action, userId });
  }
}
