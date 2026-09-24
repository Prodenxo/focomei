import { createSupabaseClient } from '../config/supabase.js';
import { canonicalizeBrazilWhatsappPhone } from '../utils/whatsapp-phone.js';
import { userHasMeiCertificate } from './mei-guide.service.js';
import { ensureGlobalCategoriesCopiedForUser } from './categories.service.js';
import { env } from '../config/env.js';
import { query } from '../config/pg.js';

/** Cliente Supabase injetável em testes. */
let getActivationDbClient = () => createSupabaseClient({ useServiceRole: true });

export const __setActivationDbClientForTests = (fn) => {
  const prev = getActivationDbClient;
  getActivationDbClient = fn;
  return () => {
    getActivationDbClient = prev;
  };
};

const isLocalAuthMode = () => env.AUTH_MODE === 'local';

export const getMonthStartDateString = (date = new Date()) => {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  return monthStart.toISOString().split('T')[0];
};

export const isProfileNameComplete = (displayName) => {
  const trimmed = String(displayName || '').trim();
  return trimmed.length >= 2;
};

export const isPhoneWhatsappComplete = (phone) => {
  return Boolean(canonicalizeBrazilWhatsappPhone(phone));
};

const STEP_COPY = {
  profile_name: {
    title: 'Seu nome',
    description: 'Como aparece no app e no bot.',
    route: 'settings:profile',
  },
  phone_whatsapp: {
    title: 'WhatsApp',
    description: 'Lance gastos e receba DAS pelo celular.',
    route: 'settings:phone',
  },
  mei_certificate: {
    title: 'Certificado MEI',
    description: 'Necessário para DAS e notas fiscais.',
    route: 'mei:certificate',
  },
  mei_das_view: {
    title: 'Consultar DAS',
    description: 'Veja o DAS do mês na área MEI.',
    route: 'mei:das',
  },
  mei_nfse_catalog: {
    title: 'Cliente NFSe',
    description: 'Cadastre pelo menos um cliente para emitir notas.',
    route: 'mei:nfse',
  },
};

/**
 * Só entram passos que o app consegue abrir (ver ACTIVATION_ROUTE_TO_SCREEN no
 * frontend). Passo sem destino fica invisível na lista e trava o gate de
 * ativação para sempre, porque o usuário não tem como concluí-lo.
 */
const CORE_STEP_IDS = [
  'profile_name',
  'phone_whatsapp',
];

const OPTIONAL_STEP_IDS = [];

const MEI_STEP_IDS = ['mei_certificate', 'mei_das_view', 'mei_nfse_catalog'];

/**
 * @param {string} stepId
 * @param {object} ctx
 * @returns {{ status: 'completed' | 'pending', completedAt: string | null }}
 */
export const evaluateStepStatus = (stepId, ctx) => {
  const now = new Date().toISOString();
  switch (stepId) {
    case 'profile_name':
      return ctx.hasProfileName
        ? { status: 'completed', completedAt: now }
        : { status: 'pending', completedAt: null };
    case 'phone_whatsapp':
      return ctx.hasPhone
        ? { status: 'completed', completedAt: now }
        : { status: 'pending', completedAt: null };
    case 'mei_certificate':
      return ctx.hasMeiCertificate
        ? { status: 'completed', completedAt: now }
        : { status: 'pending', completedAt: null };
    case 'mei_das_view':
      return ctx.hasDasActivity
        ? { status: 'completed', completedAt: now }
        : { status: 'pending', completedAt: null };
    case 'mei_nfse_catalog':
      return ctx.nfseClientsCount > 0
        ? { status: 'completed', completedAt: now }
        : { status: 'pending', completedAt: null };
    default:
      return { status: 'pending', completedAt: null };
  }
};

/**
 * @param {Array<{ id: string, required: boolean, status: string }>} steps
 */
export const computeProgressFromSteps = (steps) => {
  const requiredSteps = steps.filter((s) => s.required);
  const completedRequired = requiredSteps.filter((s) => s.status === 'completed').length;
  const totalRequired = requiredSteps.length;
  const completedAll = steps.filter((s) => s.status === 'completed').length;
  const totalAll = steps.length;
  const percent = totalRequired > 0
    ? Math.round((completedRequired / totalRequired) * 100)
    : 100;
  const percentAll = totalAll > 0
    ? Math.round((completedAll / totalAll) * 100)
    : 100;
  const isCoreComplete = totalRequired > 0 && completedRequired >= totalRequired;
  const isFullyComplete = totalAll > 0 && completedAll >= totalAll;
  const pendingCount = totalAll - completedAll;

  return {
    completed: completedRequired,
    totalRequired,
    completedAll,
    totalAll,
    percent,
    percentAll,
    pendingCount,
    /** @deprecated use isCoreComplete — mantido para compatibilidade */
    isComplete: isCoreComplete,
    isCoreComplete,
    /** Todos os passos da lista (incl. MEI e recomendados) concluídos */
    isFullyComplete,
    hasPendingSteps: pendingCount > 0,
  };
};

/**
 * @param {object} ctx
 * @param {{ showMei: boolean }} options
 */
export const buildActivationSteps = (ctx, { showMei = false } = {}) => {
  const ids = [
    ...CORE_STEP_IDS,
    ...OPTIONAL_STEP_IDS,
    ...(showMei ? MEI_STEP_IDS : []),
  ];

  return ids.map((id) => {
    const copy = STEP_COPY[id] || { title: id, description: '', route: id };
    const required = CORE_STEP_IDS.includes(id);
    const evaluated = evaluateStepStatus(id, ctx);
    return {
      id,
      title: copy.title,
      description: copy.description,
      status: evaluated.status,
      required,
      route: copy.route,
      completedAt: evaluated.completedAt,
    };
  });
};

const fetchAuthMetadata = async (admin, userId) => {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) {
    return { displayName: null, phone: null };
  }
  const meta = data.user.user_metadata || {};
  return {
    displayName: meta.display_name || meta.full_name || null,
    phone: meta.phone || null,
  };
};

const fetchMeiFlag = async (admin, userId) => {
  const { data, error } = await admin
    .from('role_x_user_x_empresa')
    .select('mei')
    .eq('user_id', userId)
    .eq('status', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return data?.mei === true;
};

export const gatherActivationContext = async (userId) => {
  if (isLocalAuthMode()) {
    return gatherActivationContextPg(userId);
  }

  const admin = getActivationDbClient();

  const [
    profileRes,
    authMeta,
    n8nRes,
    nfseClientsRes,
    dasRes,
    showMei,
    hasMeiCertificate,
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('display_name, phone')
      .eq('id', userId)
      .maybeSingle(),
    fetchAuthMetadata(admin, userId),
    admin.from('n8n_link').select('user_number').eq('user_id', userId).maybeSingle(),
    admin
      .from('mei_nfse_clientes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    admin
      .from('das_mensal_status')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    fetchMeiFlag(admin, userId),
    userHasMeiCertificate(userId).catch(() => false),
  ]);

  const profile = profileRes.data;
  const displayName = profile?.display_name || authMeta.displayName;
  const phoneRaw = profile?.phone || authMeta.phone || n8nRes.data?.user_number;

  return {
    showMei,
    ctx: {
      hasProfileName: isProfileNameComplete(displayName),
      hasPhone: isPhoneWhatsappComplete(phoneRaw),
      hasMeiCertificate: Boolean(hasMeiCertificate),
      hasDasActivity: (dasRes.count ?? 0) > 0,
      nfseClientsCount: nfseClientsRes.count ?? 0,
    },
  };
};

/** Contagem tolerante: tabela MEI ausente não pode derrubar o checklist. */
const countRowsPg = async (sql, params) => {
  try {
    const res = await query(sql, params);
    return res.rows[0]?.c ?? 0;
  } catch (error) {
    console.warn('[activation] contagem local falhou:', error?.message || error);
    return 0;
  }
};

const gatherActivationContextPg = async (userId) => {
  const [
    userRes,
    n8nRes,
    linkRes,
    nfseClientsCount,
    dasCount,
    hasMeiCertificate,
  ] = await Promise.all([
    query(
      `SELECT email, phone, raw_user_meta_data FROM public.users WHERE id = $1 LIMIT 1`,
      [userId],
    ),
    query(
      `SELECT user_number FROM public.n8n_link WHERE user_id = $1 LIMIT 1`,
      [userId],
    ),
    query(
      `SELECT mei FROM public.role_x_user_x_empresa
       WHERE user_id = $1 AND status = true
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
    ),
    countRowsPg(
      `SELECT count(*)::int AS c FROM public.mei_nfse_clientes WHERE user_id = $1`,
      [userId],
    ),
    countRowsPg(
      `SELECT count(*)::int AS c FROM public.das_mensal_status WHERE user_id = $1`,
      [userId],
    ),
    userHasMeiCertificate(userId).catch(() => false),
  ]);

  const user = userRes.rows[0];
  const meta = user?.raw_user_meta_data || {};
  const displayName = meta.display_name || meta.full_name || null;
  const phoneRaw = user?.phone || meta.phone || n8nRes.rows[0]?.user_number || null;

  return {
    showMei: linkRes.rows[0]?.mei === true,
    ctx: {
      hasProfileName: isProfileNameComplete(displayName),
      hasPhone: isPhoneWhatsappComplete(phoneRaw),
      hasMeiCertificate: Boolean(hasMeiCertificate),
      hasDasActivity: dasCount > 0,
      nfseClientsCount,
    },
  };
};

export const getActivationProgress = async (userId) => {
  if (!isLocalAuthMode()) {
    const admin = getActivationDbClient();
    await ensureGlobalCategoriesCopiedForUser(admin, userId).catch((err) => {
      console.warn('[activation] ensureGlobalCategoriesCopiedForUser:', err?.message || err);
    });
  } else {
    await ensureGlobalCategoriesCopiedForUser(null, userId).catch((err) => {
      console.warn('[activation] ensureGlobalCategoriesCopiedForUser:', err?.message || err);
    });
  }

  const { showMei, ctx } = await gatherActivationContext(userId);
  const steps = buildActivationSteps(ctx, { showMei });
  const progress = computeProgressFromSteps(steps);

  return {
    progress: {
      ...progress,
      /** Snooze “ocultar por agora” fica só no cliente (AsyncStorage), sem persistência no banco. */
      dismissStorage: 'client',
    },
    steps,
  };
};
