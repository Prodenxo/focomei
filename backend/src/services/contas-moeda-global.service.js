import { createSupabaseClient } from '../config/supabase.js';
import { badRequest, notFound } from '../utils/errors.js';
import { env } from '../config/env.js';
import { query } from '../config/pg.js';

const TABLE = 'contas_moeda_global';
const isLocalAuthMode = () => env.AUTH_MODE === 'local';

const normalizeMoeda = (moeda) => {
  const s = String(moeda || '').trim().toUpperCase();
  if (s.length !== 3) throw badRequest('moeda deve ter 3 caracteres (ex: USD)');
  return s;
};

const parseValor = (valor) => {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) throw badRequest('valor deve ser um número >= 0');
  return n;
};

const normalizeNome = (nome) => {
  if (nome == null) return null;
  const s = String(nome).trim();
  return s || null;
};

export const listContasMoedaGlobal = async (userId) => {
  if (isLocalAuthMode()) {
    const { rows } = await query(
      `SELECT * FROM public.contas_moeda_global
       WHERE user_id = $1 AND ativo = true
       ORDER BY moeda ASC`,
      [userId],
    );
    return rows || [];
  }

  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('ativo', true)
    .order('moeda', { ascending: true });

  if (error) throw badRequest(error.message);
  return data || [];
};

export const createContaMoedaGlobal = async (userId, payload = {}) => {
  const moeda = normalizeMoeda(payload.moeda);
  const valor = parseValor(payload.valor ?? 0);
  const nome = normalizeNome(payload.nome);
  const ativo = payload.ativo !== false;

  if (isLocalAuthMode()) {
    const { rows } = await query(
      `INSERT INTO public.contas_moeda_global (user_id, moeda, nome, valor, ativo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, moeda, nome, valor, ativo],
    );
    return rows[0];
  }

  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from(TABLE)
    .insert([{
      user_id: userId,
      moeda,
      nome,
      valor,
      ativo,
    }])
    .select('*')
    .single();

  if (error) throw badRequest(error.message);
  return data;
};

export const updateContaMoedaGlobal = async (userId, id, payload = {}) => {
  if (!id) throw badRequest('ID é obrigatório');

  const updates = { atualizado_em: new Date().toISOString() };
  if (payload.moeda !== undefined) updates.moeda = normalizeMoeda(payload.moeda);
  if (payload.valor !== undefined) updates.valor = parseValor(payload.valor);
  if (payload.nome !== undefined) updates.nome = normalizeNome(payload.nome);
  if (payload.ativo !== undefined) updates.ativo = payload.ativo !== false;

  if (isLocalAuthMode()) {
    const { rows } = await query(
      `UPDATE public.contas_moeda_global SET
        moeda = COALESCE($3, moeda),
        nome = CASE WHEN $4::boolean THEN $5 ELSE nome END,
        valor = COALESCE($6, valor),
        ativo = COALESCE($7, ativo),
        atualizado_em = now()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [
        id,
        userId,
        updates.moeda ?? null,
        Object.prototype.hasOwnProperty.call(updates, 'nome'),
        updates.nome ?? null,
        updates.valor ?? null,
        updates.ativo ?? null,
      ],
    );
    if (!rows[0]) throw notFound('Conta moeda global não encontrada');
    return rows[0];
  }

  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from(TABLE)
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw badRequest(error.message);
  if (!data) throw notFound('Conta moeda global não encontrada');
  return data;
};

export const deleteContaMoedaGlobal = async (userId, id) => {
  if (!id) throw badRequest('ID é obrigatório');

  if (isLocalAuthMode()) {
    const { rows } = await query(
      `DELETE FROM public.contas_moeda_global
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId],
    );
    if (!rows[0]) throw notFound('Conta moeda global não encontrada');
    return { id: rows[0].id };
  }

  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from(TABLE)
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (error) throw badRequest(error.message);
  if (!data) throw notFound('Conta moeda global não encontrada');
  return { id: data.id };
};
