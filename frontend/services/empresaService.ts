import { apiClient } from '../lib/apiClient';
import { isValidCnpjDigits } from '../lib/validateCnpj';
import type { CnpjLookupData } from './meiNotasService';
import { isLocalApiAuthMode } from '../lib/authMode';
import { supabase } from '../lib/supabase';

export interface EmpresaFullData {
  id?: string;
  empresa?: string;
  max_mei?: number | null;
  max_usuarios_nao_mei?: number | null;
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  inscricao_estadual?: string;
  regime_tributario?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  access_status?: 'active' | 'blocked';
  blocked_at?: string | null;
  blocked_by?: string | null;
}

export interface EmpresaOption {
  id: string;
  empresa: string;
  nome_fantasia?: string;
  max_mei?: number | null;
  max_usuarios_nao_mei?: number | null;
  product_line?: string | null;
  access_status?: 'active' | 'blocked';
  blocked_at?: string | null;
  blocked_by?: string | null;
}

export interface EmpresaLimitsPayload {
  empresa: string;
  max_mei?: number | null;
  max_usuarios_nao_mei?: number | null;
}

export interface EmpresaUpdatePayload {
  empresa?: string;
  max_mei?: number | null;
  max_usuarios_nao_mei?: number | null;
}

export async function listEmpresas(): Promise<EmpresaOption[]> {
  try {
    const res = await apiClient.get<{ empresas?: EmpresaOption[] }>('/users/empresas');
    return res?.empresas ?? [];
  } catch (err) {
    // AUTH_MODE=local: edge functions estão bloqueadas — não mascarar o 401/erro real.
    if (isLocalApiAuthMode()) throw err;
    const { data, error } = await supabase.functions.invoke<{ empresas?: EmpresaOption[] }>('list-empresas');
    if (error) throw error;
    return data?.empresas ?? [];
  }
}

export async function getEmpresa(): Promise<EmpresaFullData | null> {
  try {
    const res = await apiClient.get<{ empresa?: EmpresaFullData }>('/users/empresas/current');
    return res?.empresa ?? null;
  } catch {
    return null;
  }
}

export async function getEmpresaById(empresaId: string): Promise<EmpresaFullData | null> {
  try {
    const res = await apiClient.get<{ empresa?: EmpresaFullData }>(`/users/empresas/${encodeURIComponent(empresaId)}`);
    return res?.empresa ?? null;
  } catch {
    return null;
  }
}

export async function createEmpresa(input: EmpresaFullData): Promise<EmpresaFullData> {
  const res = await apiClient.post<{ empresa: EmpresaFullData }>('/users/empresas', input);
  if (!res?.empresa) throw new Error('Resposta inválida ao criar empresa');
  return res.empresa;
}

export async function updateEmpresa(empresaId: string, input: EmpresaFullData): Promise<EmpresaFullData> {
  const res = await apiClient.put<{ empresa: EmpresaFullData }>(
    `/users/empresas/${encodeURIComponent(empresaId)}`,
    input
  );
  if (!res?.empresa) throw new Error('Resposta inválida ao atualizar empresa');
  return res.empresa;
}

export async function deleteEmpresa(empresaId: string): Promise<void> {
  await apiClient.delete(`/users/empresas/${encodeURIComponent(empresaId)}`);
}

export async function blockEmpresa(
  empresaId: string,
  reason?: string,
): Promise<EmpresaOption> {
  const result = await apiClient.post<{ empresa: EmpresaOption }>(
    `/users/empresas/${encodeURIComponent(empresaId)}/block`,
    { reason: reason?.trim() || null },
  );
  return result.empresa;
}

export async function unblockEmpresa(
  empresaId: string,
  reason?: string,
): Promise<EmpresaOption> {
  const result = await apiClient.post<{ empresa: EmpresaOption }>(
    `/users/empresas/${encodeURIComponent(empresaId)}/unblock`,
    { reason: reason?.trim() || null },
  );
  return result.empresa;
}

export interface AccessBlockAuditEntry {
  id: number;
  target_type: 'empresa' | 'usuario';
  target_id: string;
  actor_user_id: string;
  previous_status: 'active' | 'blocked';
  new_status: 'active' | 'blocked';
  reason?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export async function listAccessBlockAudit(
  targetType?: 'empresa' | 'usuario',
  targetId?: string,
): Promise<AccessBlockAuditEntry[]> {
  const params = new URLSearchParams();
  if (targetType) params.set('targetType', targetType);
  if (targetId) params.set('targetId', targetId);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const result = await apiClient.get<{ entries?: AccessBlockAuditEntry[] }>(
    `/users/access-block-audit${suffix}`,
  );
  return result.entries || [];
}

export interface CnpjLookupResult {
  cpfCnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  email: string | null;
  telefone: { ddd: string; numero: string } | null;
  inscricaoMunicipal: string | null;
  inscricaoEstadual: string | null;
  endereco: {
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    codigoCidade: string | null;
    descricaoCidade: string | null;
    estado: string | null;
    cep: string | null;
  };
  situacaoCadastral?: string | null;
  porte?: string | null;
  opcaoSimples?: boolean | null;
}

const shouldFallbackCnpjLookup = (error: unknown) => {
  if (!(error instanceof Error)) return true;
  const msg = error.message.toLowerCase();
  if (msg.includes('not authenticated') || msg.includes('não autenticado')) return false;
  if (msg.includes('inválido') || msg.includes('14 dígitos')) return false;
  if (msg.includes('não encontrado')) return false;
  return true;
};

const fromClientCnpjLookup = (data: CnpjLookupData): CnpjLookupResult => ({
  cpfCnpj: data.cpfCnpj,
  razaoSocial: data.razaoSocial,
  nomeFantasia: data.nomeFantasia,
  email: data.email,
  telefone: data.telefone,
  inscricaoMunicipal: data.inscricaoMunicipal,
  inscricaoEstadual: data.inscricaoEstadual,
  endereco: {
    logradouro: data.endereco?.logradouro ?? null,
    numero: data.endereco?.numero ?? null,
    complemento: data.endereco?.complemento ?? null,
    bairro: data.endereco?.bairro ?? null,
    codigoCidade: data.endereco?.codigoCidade ?? null,
    descricaoCidade: data.endereco?.descricaoCidade ?? null,
    estado: data.endereco?.estado ?? null,
    cep: data.endereco?.cep ?? null,
  },
  situacaoCadastral: data.situacaoCadastral,
  porte: data.porte,
  opcaoSimples: data.opcaoSimples,
});

/** Consulta dados cadastrais (PlugNotas + BrasilAPI no backend; fallback direto BrasilAPI no dispositivo). */
export async function lookupEmpresaCnpj(cnpj: string): Promise<CnpjLookupResult> {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) throw new Error('CNPJ deve ter 14 dígitos.');
  if (!isValidCnpjDigits(digits)) {
    throw new Error('CNPJ inválido. Verifique os dígitos informados.');
  }

  try {
    return await apiClient.get<CnpjLookupResult>(`/users/empresas/cnpj-lookup/${digits}`);
  } catch (backendError) {
    if (!shouldFallbackCnpjLookup(backendError)) throw backendError;
    const { lookupCnpj } = await import('./meiNotasService');
    const data = await lookupCnpj(digits);
    return fromClientCnpjLookup(data);
  }
}

export async function createEmpresaLimits(input: EmpresaLimitsPayload): Promise<EmpresaFullData> {
  const res = await apiClient.post<{ empresa: EmpresaFullData }>('/users/empresas', input);
  if (!res?.empresa) throw new Error('Resposta inválida ao criar empresa');
  return res.empresa;
}

export async function updateEmpresaLimits(
  empresaId: string,
  input: EmpresaUpdatePayload,
): Promise<EmpresaFullData> {
  const res = await apiClient.put<{ empresa: EmpresaFullData }>(
    `/users/empresas/${encodeURIComponent(empresaId)}`,
    input,
  );
  if (!res?.empresa) throw new Error('Resposta inválida ao atualizar empresa');
  return res.empresa;
}
