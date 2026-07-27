import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';
import { useAuthStore } from './authStore';

export interface Recorrencia {
  id: string;
  user_id: string;
  dia_do_mes: number;
  valor: number;
  classificacao: string;
  tipo: string;
  status: string;
  obs?: string | null;
  categoria?: string | null;
  ativo: boolean;
  max_ocorrencias?: number | null;
  ocorrencias_geradas?: number;
  criado_em: string;
  atualizado_em: string;
}

export type RecorrenciaInput = Omit<
  Recorrencia,
  'id' | 'user_id' | 'criado_em' | 'atualizado_em'
>;

export type DeleteRecorrenciaResult =
  | { ok: true; mode: 'hard' | 'soft' }
  | { ok: false; error: string };

export interface RecorrenciaSkip {
  recorrencia_id: string;
  ano_mes: string; // "YYYY-MM"
}

interface RecorrenciaState {
  recorrencias: Recorrencia[];
  skips: RecorrenciaSkip[];
  loading: boolean;
  error: string | null;
  fetchRecorrencias: () => Promise<void>;
  fetchSkips: () => Promise<void>;
  addSkip: (recorrenciaId: string, anoMes: string) => Promise<boolean>;
  addRecorrencia: (row: RecorrenciaInput) => Promise<Recorrencia | null>;
  updateRecorrencia: (id: string, patch: Partial<RecorrenciaInput>) => Promise<void>;
  deleteRecorrencia: (id: string) => Promise<DeleteRecorrenciaResult>;
}

function normalizeRow(r: Record<string, unknown>): Recorrencia {
  return {
    id: String(r.id ?? ''),
    user_id: String(r.user_id ?? ''),
    dia_do_mes: Number(r.dia_do_mes ?? 0),
    valor: typeof r.valor === 'string' ? parseFloat(r.valor) : Number(r.valor),
    classificacao: String(r.classificacao ?? ''),
    tipo: String(r.tipo ?? ''),
    status: String(r.status ?? 'pago'),
    obs: r.obs != null ? String(r.obs) : null,
    categoria: r.categoria != null ? String(r.categoria) : null,
    ativo: Boolean(r.ativo),
    max_ocorrencias: r.max_ocorrencias != null ? Number(r.max_ocorrencias) : null,
    ocorrencias_geradas: r.ocorrencias_geradas != null ? Number(r.ocorrencias_geradas) : 0,
    criado_em: String(r.criado_em ?? ''),
    atualizado_em: String(r.atualizado_em ?? ''),
  };
}

export const useRecorrenciaStore = create<RecorrenciaState>((set, get) => ({
  recorrencias: [],
  skips: [],
  loading: false,
  error: null,

  fetchSkips: async () => {
    const userId = useAuthStore.getState().userId;
    if (!userId) return;
    try {
      const data = await apiClient.get<Record<string, unknown>[]>('/recorrencias/skips');
      set({
        skips: (data || []).map((row) => ({
          recorrencia_id: String(row.recorrencia_id ?? ''),
          ano_mes: String(row.ano_mes ?? ''),
        })),
      });
    } catch (e: unknown) {
      console.warn('[recorrenciaStore] fetchSkips error:', e);
    }
  },

  addSkip: async (recorrenciaId, anoMes) => {
    const userId = useAuthStore.getState().userId;
    if (!userId) return false;
    try {
      await apiClient.post('/recorrencias/skips', {
        recorrencia_id: recorrenciaId,
        ano_mes: anoMes,
      });
      const current = get().skips;
      const already = current.some(
        (s) => s.recorrencia_id === recorrenciaId && s.ano_mes === anoMes,
      );
      if (!already) {
        set({ skips: [...current, { recorrencia_id: recorrenciaId, ano_mes: anoMes }] });
      }
      return true;
    } catch (e: unknown) {
      console.warn('[recorrenciaStore] addSkip error:', e);
      return false;
    }
  },

  fetchRecorrencias: async () => {
    const userId = useAuthStore.getState().userId;
    if (!userId) {
      set({ error: 'Usuário não autenticado' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const data = await apiClient.get<Record<string, unknown>[]>('/recorrencias');
      set({
        recorrencias: (data || []).map((r) => normalizeRow(r)),
        loading: false,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar recorrências';
      set({ error: msg, loading: false });
    }
  },

  addRecorrencia: async (row) => {
    const userId = useAuthStore.getState().userId;
    if (!userId) {
      set({ error: 'Usuário não autenticado' });
      return null;
    }
    set({ error: null });
    try {
      const payload = {
        ...row,
        valor: typeof row.valor === 'number' ? row.valor : parseFloat(String(row.valor)),
      };
      const data = await apiClient.post<Record<string, unknown>>('/recorrencias', payload);
      await get().fetchRecorrencias();
      return data ? normalizeRow(data) : null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao criar recorrência';
      set({ error: msg });
      return null;
    }
  },

  updateRecorrencia: async (id, patch) => {
    const userId = useAuthStore.getState().userId;
    if (!userId) {
      set({ error: 'Usuário não autenticado' });
      return;
    }
    set({ error: null });
    try {
      const data: Record<string, unknown> = { ...patch };
      if (patch.valor != null) {
        data.valor =
          typeof patch.valor === 'number' ? patch.valor : parseFloat(String(patch.valor));
      }
      await apiClient.put(`/recorrencias/${encodeURIComponent(id)}`, data);
      await get().fetchRecorrencias();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao atualizar recorrência';
      set({ error: msg });
    }
  },

  deleteRecorrencia: async (id) => {
    const userId = useAuthStore.getState().userId;
    if (!userId) {
      const msg = 'Usuário não autenticado';
      set({ error: msg });
      return { ok: false, error: msg };
    }
    set({ error: null });
    try {
      const result = await apiClient.delete<{ mode: 'hard' | 'soft' }>(
        `/recorrencias/${encodeURIComponent(id)}`,
      );
      await get().fetchRecorrencias();
      return { ok: true, mode: result?.mode ?? 'hard' };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao excluir recorrência';
      set({ error: msg });
      return { ok: false, error: msg };
    }
  },
}));
