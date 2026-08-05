import { createSupabaseClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { query } from '../config/pg.js';
import { badRequest } from '../utils/errors.js';
import { isLocalAuthMode } from './local-auth.service.js';

const SUPABASE_TABLE = 'DAS_mei';

const normalizePeriodo = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 6) return null;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  if (month < 1 || month > 12) return null;
  const periodoDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  return {
    raw: digits,
    iso: periodoDate.toISOString(),
  };
};

const getSupabase = () => {
  if (isLocalAuthMode()) {
    return createSupabaseClient({ useServiceRole: true });
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw badRequest('Supabase não configurado para persistência do DAS');
  }
  return createSupabaseClient({ useServiceRole: true });
};

const upsertDasBase64Pg = async ({ userId, periodoApuracao, pdfBase64 }) => {
  const periodo = normalizePeriodo(periodoApuracao);
  if (!periodo) {
    throw badRequest('Período de apuração inválido para persistência do DAS');
  }

  try {
    await query(
      `DELETE FROM public.das_mei
       WHERE user_id = $1 AND periodo_apuracao = $2`,
      [userId, periodo.iso],
    );
    await query(
      `INSERT INTO public.das_mei (user_id, periodo_apuracao, das)
       VALUES ($1, $2, $3)`,
      [userId, periodo.iso, pdfBase64],
    );
  } catch (error) {
    const message = String(error?.message || '');
    if (/relation.*das_mei|does not exist/i.test(message)) {
      throw badRequest('Tabela das_mei não encontrada no Postgres. Verifique as migrations do EasyPanel.');
    }
    throw badRequest(message || 'Falha ao salvar DAS em base64');
  }

  return { userId, periodoApuracao: periodo.raw };
};

const getDasBase64Pg = async ({ userId, periodoApuracao }) => {
  const periodo = normalizePeriodo(periodoApuracao);
  if (!periodo) {
    throw badRequest('Período de apuração inválido para consulta do DAS');
  }

  const year = Number(periodo.raw.slice(0, 4));
  const month = Number(periodo.raw.slice(4, 6));
  const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString();
  const periodEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0)).toISOString();

  try {
    const { rows } = await query(
      `SELECT das FROM public.das_mei
       WHERE user_id = $1
         AND (
           periodo_apuracao = $2
           OR (periodo_apuracao >= $3 AND periodo_apuracao < $4)
         )
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, periodo.iso, periodStart, periodEnd],
    );
    return rows[0]?.das || null;
  } catch (error) {
    console.warn('[das-base64] falha ao ler das_mei:', error?.message || error);
    return null;
  }
};

const deleteDasBase64Pg = async ({ userId, periodoApuracao }) => {
  const periodo = normalizePeriodo(periodoApuracao);
  if (!periodo) throw badRequest('Período inválido');

  const year = Number(periodo.raw.slice(0, 4));
  const month = Number(periodo.raw.slice(4, 6));
  const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString();
  const periodEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0)).toISOString();

  await query(
    `DELETE FROM public.das_mei
     WHERE user_id = $1
       AND (
         periodo_apuracao = $2
         OR (periodo_apuracao >= $3 AND periodo_apuracao < $4)
       )`,
    [userId, periodo.iso, periodStart, periodEnd],
  );
  return { deleted: true, periodoApuracao: periodo.raw };
};

export const upsertDasBase64 = async ({ userId, periodoApuracao, pdfBase64 }) => {
  if (!userId) {
    throw badRequest('Usuário não informado para persistência do DAS');
  }
  if (!pdfBase64) {
    throw badRequest('Base64 do DAS não informado');
  }

  if (isLocalAuthMode()) {
    return upsertDasBase64Pg({ userId, periodoApuracao, pdfBase64 });
  }

  const periodo = normalizePeriodo(periodoApuracao);
  if (!periodo) {
    throw badRequest('Período de apuração inválido para persistência do DAS');
  }
  const supabase = getSupabase();
  const { error } = await supabase
    .from(SUPABASE_TABLE)
    .upsert({
      user_id: userId,
      periodo_apuracao: periodo.iso,
      DAS: pdfBase64,
    }, { onConflict: 'user_id,periodo_apuracao' });
  if (error) {
    throw badRequest(error.message || 'Falha ao salvar DAS em base64');
  }
  return { userId, periodoApuracao: periodo.raw };
};

export const getDasBase64 = async ({ userId, periodoApuracao }) => {
  if (!userId) {
    throw badRequest('Usuário não informado para consulta do DAS');
  }

  if (isLocalAuthMode()) {
    return getDasBase64Pg({ userId, periodoApuracao });
  }

  const periodo = normalizePeriodo(periodoApuracao);
  if (!periodo) {
    throw badRequest('Período de apuração inválido para consulta do DAS');
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select('DAS')
    .eq('user_id', userId)
    .eq('periodo_apuracao', periodo.iso)
    .maybeSingle();
  if (error) {
    throw badRequest(error.message || 'Falha ao consultar DAS em base64');
  }
  return data?.DAS || null;
};

/** Remove PDF armazenado (ex.: ficheiro de outra pessoa gravado por engano). */
export const deleteDasBase64 = async ({ userId, periodoApuracao }) => {
  if (!userId) throw badRequest('Usuário não informado');

  if (isLocalAuthMode()) {
    return deleteDasBase64Pg({ userId, periodoApuracao });
  }

  const periodo = normalizePeriodo(periodoApuracao);
  if (!periodo) throw badRequest('Período inválido');
  const supabase = getSupabase();
  const { error } = await supabase
    .from(SUPABASE_TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('periodo_apuracao', periodo.iso);
  if (error) throw badRequest(error.message || 'Falha ao remover DAS armazenado');
  return { deleted: true, periodoApuracao: periodo.raw };
};
