import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { createSupabaseClient } from "../config/supabase.js";
import { env } from "../config/env.js";
import { badRequest, forbidden } from "../utils/errors.js";
import { getRequesterContext } from "./users.service.js";
import {
  resolveMeiPricing as resolveMeiPricingRaw,
  MEI_PRICING_INVALID_MESSAGE,
  MEI_PUBLIC_PACKAGES,
} from "./mei-billing-pricing.js";
import {
  emitOnetyContratoAfterStripePayment,
  emitContratoForEmpresaOrThrow,
  buildStripeContratoPayloadForEmpresa,
  resolveContratoSignatarioForEmpresa,
  parseContratoWebhookMeta,
  dispatchOnetyContratoStatusCheck,
  dispatchOnetyContratoLinkFetch,
} from "./stripe-contract-payload.service.js";
import { getFunilById, getSelfServeFunil, ONETY_CRM_SELF_SERVE_FUNIL_ID } from "../config/onety-crm-funis.js";
import { prepararPropostaCrmForEmpresaOrThrow } from "./onety-crm.service.js";
import {
  buildMeiLineInsertPayload,
  hasMeiLineApprovalColumns,
  insertMeiSubscriptionLine,
  isMissingApprovalColumnError,
  updateMeiSubscriptionLine,
} from "./mei-line-approval-columns.service.js";

const ONLY_DIGITS = (s) => String(s || "").replace(/\D/g, "");

const parseBoolEnv = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const t = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "sim"].includes(t)) return true;
  if (["0", "false", "no", "nao", "não"].includes(t)) return false;
  return fallback;
};

const resolveMeiPricing = (meiSlots) => {
  const pricing = resolveMeiPricingRaw(meiSlots);
  if (!pricing) {
    if (!Number.isInteger(meiSlots) || meiSlots <= 0) {
      throw badRequest("meiSlots inválido");
    }
    throw badRequest(MEI_PRICING_INVALID_MESSAGE);
  }
  return pricing;
};

const mapStripeSubscriptionStatus = (stripeStatus) => {
  const s = String(stripeStatus || "").toLowerCase();
  if (s === "active" || s === "trialing") return "active";
  if (s === "canceled" || s === "incomplete_expired") return "cancelled";
  return "pending";
};

const normalizeBillingTiming = (raw) => {
  const t = String(raw || "checkout")
    .trim()
    .toLowerCase();
  if (
    ["next_cycle", "next_invoice", "proxima_fatura", "próxima_fatura"].includes(
      t,
    )
  ) {
    return "next_cycle";
  }
  return "checkout";
};

/**
 * Escolhe uma Subscription Stripe ativa da empresa (mais recente na BD).
 */
const resolveStripeSubscriptionIdForEmpresa = async (
  adminClient,
  empresaId,
  explicitSubId,
) => {
  const explicit = String(explicitSubId || "").trim();
  if (explicit) return explicit;

  const { data: rows, error } = await adminClient
    .from("empresa_mei_subscription_lines")
    .select("stripe_subscription_id")
    .eq("empresa_id", empresaId)
    .eq("status", "active")
    .not("stripe_subscription_id", "is", null)
    .order("updated_at", { ascending: false });

  if (error) throw badRequest(error.message);
  const first = (rows || []).find((r) =>
    String(r.stripe_subscription_id || "").trim(),
  );
  return first ? String(first.stripe_subscription_id).trim() : "";
};

let stripeSingleton = null;
export const getStripe = () => {
  const key = String(env.STRIPE_SECRET_KEY || "").trim();
  if (!key) {
    throw badRequest("Stripe não configurado: defina STRIPE_SECRET_KEY");
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key);
  }
  return stripeSingleton;
};

/**
 * Atualiza `empresas.max_mei` com a soma de `mei_slots` das linhas Stripe ativas.
 * @param {object} [options]
 * @param {boolean} [options.force] — `true`: evento da Stripe ou ação superadmin (sempre grava).
 *   `false`/omitido: respeita `STRIPE_SYNC_MAX_MEI=false` para não sobrescrever limite manual em fluxos futuros.
 *   **Todos os webhooks e confirmações de cobrança Stripe usam `force: true`.**
 */
export const syncEmpresaMaxMeiFromLines = async (
  adminClient,
  empresaId,
  options = {},
) => {
  const force = options.force === true;
  if (!force && !parseBoolEnv(env.STRIPE_SYNC_MAX_MEI, true)) return;

  const { data: lines, error } = await adminClient
    .from("empresa_mei_subscription_lines")
    .select("mei_slots")
    .eq("empresa_id", empresaId)
    .eq("status", "active");

  if (error) throw badRequest(error.message);

  const sum = (lines || []).reduce(
    (acc, row) => acc + Number(row.mei_slots || 0),
    0,
  );
  const { error: upErr } = await adminClient
    .from("empresas")
    .update({ max_mei: sum })
    .eq("id", empresaId);

  if (upErr) throw badRequest(upErr.message);

  return { max_mei: sum };
};

/**
 * Após pagamento: empresa active + admin criador com mei=true (libera o app).
 */
export const activateEmpresaMeiAccessAfterPayment = async (
  adminClient,
  empresaId,
) => {
  const id = String(empresaId || "").trim();
  if (!id) return { activated: false };

  await adminClient.from("empresas").update({ status: "active" }).eq("id", id);

  const { data: empresa } = await adminClient
    .from("empresas")
    .select("requested_by")
    .eq("id", id)
    .maybeSingle();

  const ownerId = String(empresa?.requested_by || "").trim();
  if (ownerId) {
    await adminClient
      .from("role_x_user_x_empresa")
      .update({ status: true, mei: true })
      .eq("user_id", ownerId)
      .eq("empresas_id", id);
  }

  return { activated: true, ownerId: ownerId || null };
};

/**
 * Superadmin: força `max_mei` = soma das linhas ativas (corrige histórico quando o sync estava desligado).
 */
export const forceSyncEmpresaMaxMeiFromLines = async (
  accessToken,
  empresaId,
) => {
  const requester = await getRequesterContext(accessToken);
  if (requester.role !== "superadmin") throw forbidden();

  const id = String(empresaId || "").trim();
  if (!id) throw badRequest("empresaId é obrigatório");

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const result = await syncEmpresaMaxMeiFromLines(adminClient, id, {
    force: true,
  });
  return result || { max_mei: 0 };
};

/**
 * Garante Customer Stripe na empresa (CNPJ BR + nome + email).
 */
export const ensureEmpresaStripeCustomer = async (adminClient, empresa) => {
  if (empresa.stripe_customer_id) {
    return empresa.stripe_customer_id;
  }

  const stripe = getStripe();
  const cnpjDigits = ONLY_DIGITS(empresa.cnpj);
  if (!cnpjDigits || cnpjDigits.length !== 14) {
    throw badRequest(
      "Empresa sem CNPJ válido (14 dígitos) para cadastro na Stripe",
    );
  }

  const name =
    String(
      empresa.razao_social || empresa.nome_fantasia || empresa.empresa || "",
    ).trim() || `Empresa ${cnpjDigits}`;
  const email = String(empresa.email || "").trim();
  if (!email) {
    throw badRequest("Empresa sem email para cadastro na Stripe");
  }

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      empresa_id: String(empresa.id),
      cnpj: cnpjDigits,
    },
  });

  const { error } = await adminClient
    .from("empresas")
    .update({ stripe_customer_id: customer.id })
    .eq("id", empresa.id);

  if (error) throw badRequest(error.message);

  return customer.id;
};

/**
 * Cria Checkout Session (pagamento já) ou acrescenta item à assinatura existente (cobrança no próximo ciclo).
 * `billingTiming`: `checkout` (padrão) | `next_cycle` (próxima fatura, sem prorata).
 * Superadmin (qualquer empresa) ou admin da própria empresa (self-serve).
 */
export const createMeiStripeCheckoutSession = async (
  accessToken,
  input = {},
) => {
  const requester = await getRequesterContext(accessToken);
  const isSuperadmin = requester.role === "superadmin";
  const isAdmin = requester.role === "admin";
  if (!isSuperadmin && !isAdmin) throw forbidden();

  let empresaId = String(input.empresaId || "").trim();
  if (isAdmin) {
    if (!requester.empresaId) throw forbidden("Empresa não vinculada ao usuário");
    empresaId = String(requester.empresaId);
  }

  const meiSlots = Number(input.meiSlots);
  const pricing = resolveMeiPricing(meiSlots);
  const providedValue = input.value === undefined ? null : Number(input.value);
  const description =
    String(input.description || "").trim() ||
    `Assinatura MEI (${meiSlots} vagas - R$ ${pricing.total.toFixed(2)}/mês)`;
  const billingTiming = normalizeBillingTiming(input.billingTiming);

  if (!empresaId) throw badRequest("empresaId é obrigatório");
  if (
    providedValue !== null &&
    (!Number.isFinite(providedValue) || providedValue <= 0)
  ) {
    throw badRequest("value inválido");
  }
  if (
    providedValue !== null &&
    Math.abs(providedValue - pricing.total) > 0.01
  ) {
    throw badRequest(
      `value divergente: para ${meiSlots} MEIs o valor correto é ${pricing.total.toFixed(2)}`,
    );
  }

  // Self-serve (admin): só checkout da 1ª assinatura — add-on next_cycle fica no painel superadmin.
  if (isAdmin && !isSuperadmin && billingTiming !== "checkout") {
    throw badRequest(
      'Para contratar o plano, use o Checkout. Ampliação de vagas: fale com o suporte.',
    );
  }

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data: empresa, error: empErr } = await adminClient
    .from("empresas")
    .select(
      "id, empresa, cnpj, razao_social, nome_fantasia, email, stripe_customer_id",
    )
    .eq("id", empresaId)
    .maybeSingle();

  if (empErr) throw badRequest(empErr.message);
  if (!empresa?.id) throw badRequest("Empresa não encontrada");

  const unitAmount = Math.round(pricing.total * 100);
  if (!Number.isFinite(unitAmount) || unitAmount < 50) {
    throw badRequest("Valor em centavos inválido para Stripe");
  }

  const externalReference =
    String(input.externalReference || "").trim() || randomUUID();
  const stripe = getStripe();

  if (billingTiming === "next_cycle") {
    await ensureEmpresaStripeCustomer(adminClient, empresa);
    const subId = await resolveStripeSubscriptionIdForEmpresa(
      adminClient,
      empresaId,
      input.stripeSubscriptionId,
    );
    if (!subId) {
      throw badRequest(
        'Nenhuma assinatura Stripe ativa para esta empresa. Use billingTiming "checkout" na primeira compra ou informe stripeSubscriptionId.',
      );
    }

    const sub = await stripe.subscriptions.retrieve(subId, {
      expand: ["items.data"],
    });
    const st = String(sub.status || "").toLowerCase();
    if (st !== "active" && st !== "trialing") {
      throw badRequest(
        "Assinatura Stripe não está ativa; não é possível acrescentar na próxima fatura",
      );
    }

    const itemsPayload = (sub.items?.data || []).map((item) => ({
      id: item.id,
      quantity: item.quantity,
    }));

    // subscriptions.update exige price_data.product (ID), não product_data (Checkout aceita product_data).
    const product = await stripe.products.create({
      name: description,
      metadata: { mei_slots: String(meiSlots) },
    });

    itemsPayload.push({
      price_data: {
        currency: "brl",
        unit_amount: unitAmount,
        product: product.id,
        recurring: { interval: "month" },
      },
      quantity: 1,
    });

    const updated = await stripe.subscriptions.update(subId, {
      items: itemsPayload,
      proration_behavior: "none",
    });

    const { data: row, error: insErr } = await adminClient
      .from("empresa_mei_subscription_lines")
      .insert({
        empresa_id: empresaId,
        mei_slots: meiSlots,
        stripe_subscription_id: subId,
        status: "active",
        value_numeric: pricing.total,
        billing_type: "stripe_next_cycle",
        external_reference: externalReference,
        description,
      })
      .select()
      .maybeSingle();

    if (insErr) throw badRequest(insErr.message);

    await syncEmpresaMaxMeiFromLines(adminClient, empresaId, { force: true });
    await activateEmpresaMeiAccessAfterPayment(adminClient, empresaId);

    return {
      line: row,
      checkoutUrl: null,
      billingTiming: "next_cycle",
      pricing,
      stripe: { subscription: updated },
    };
  }

  const existingActiveSubId = await resolveStripeSubscriptionIdForEmpresa(
    adminClient,
    empresaId,
    null,
  );
  if (existingActiveSubId) {
    throw badRequest(
      'Esta empresa já possui assinatura MEI ativa na Stripe. Use billingTiming "next_cycle" para acrescentar vagas (sem novo Checkout).',
    );
  }

  const baseFrontend = String(
    env.FRONTEND_URL || "http://localhost:3000",
  ).replace(/\/$/, "");
  const defaultSuccess = isAdmin && !isSuperadmin
    ? `${baseFrontend}/planos?stripe_mei=success&session_id={CHECKOUT_SESSION_ID}`
    : `${baseFrontend}/admin?stripe_mei=success&session_id={CHECKOUT_SESSION_ID}`;
  const defaultCancel = isAdmin && !isSuperadmin
    ? `${baseFrontend}/planos?stripe_mei=cancel`
    : `${baseFrontend}/admin?stripe_mei=cancel`;
  const successUrl =
    String(input.successUrl || "").trim() || defaultSuccess;
  const cancelUrl =
    String(input.cancelUrl || "").trim() || defaultCancel;

  if (!successUrl.includes("{CHECKOUT_SESSION_ID}")) {
    throw badRequest(
      "successUrl deve conter o placeholder {CHECKOUT_SESSION_ID}",
    );
  }

  const customerId = await ensureEmpresaStripeCustomer(adminClient, empresa);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: empresaId,
    line_items: [
      {
        price_data: {
          currency: "brl",
          unit_amount: unitAmount,
          recurring: { interval: "month" },
          product_data: {
            name: description,
            metadata: { mei_slots: String(meiSlots) },
          },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      empresa_id: empresaId,
      mei_slots: String(meiSlots),
      external_reference: externalReference,
      self_serve: isAdmin && !isSuperadmin ? "1" : "0",
    },
    subscription_data: {
      metadata: {
        empresa_id: empresaId,
        mei_slots: String(meiSlots),
        external_reference: externalReference,
      },
    },
  });

  const { data: row, error: insErr } = await adminClient
    .from("empresa_mei_subscription_lines")
    .insert({
      empresa_id: empresaId,
      mei_slots: meiSlots,
      stripe_checkout_session_id: session.id,
      status: "pending",
      value_numeric: pricing.total,
      billing_type: "stripe_checkout",
      external_reference: externalReference,
      description,
    })
    .select()
    .maybeSingle();

  if (insErr) throw badRequest(insErr.message);

  return {
    line: row,
    checkoutUrl: session.url,
    billingTiming: "checkout",
    pricing,
  };
};

export const listSubscriptionLinesForEmpresa = async (
  accessToken,
  empresaId,
) => {
  const requester = await getRequesterContext(accessToken);
  const isSuperadmin = requester.role === "superadmin";
  const isAdmin = requester.role === "admin";
  if (!isSuperadmin && !isAdmin) throw forbidden();

  let id = String(empresaId || "").trim();
  if (isAdmin && !isSuperadmin) {
    id = String(requester.empresaId || "").trim();
  }
  if (!id) throw badRequest("empresaId é obrigatório");

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await adminClient
    .from("empresa_mei_subscription_lines")
    .select("*")
    .eq("empresa_id", id)
    .order("created_at", { ascending: false });

  if (error) throw badRequest(error.message);
  return { lines: data || [] };
};

const MEI_LINE_CONTRACT_SELECT_FULL =
  "id, status, billing_type, contrato_status, contrato_signing_url, contrato_onety_id, onety_funil_id, onety_lead_id, mei_slots";

const MEI_LINE_CONTRACT_SELECT_MIN =
  "id, status, billing_type, mei_slots";

const isPendingContractFirstLine = (line) => {
  if (!line?.id) return false;
  const billingType = String(line.billing_type || "").toLowerCase();
  if (billingType === "contract_first") return true;
  if (line.contrato_onety_id) return true;
  const contratoStatus = String(line.contrato_status || "").toLowerCase();
  return [
    "awaiting_signature",
    "sent",
    "client_signed",
    "fully_signed",
    "pending",
  ].includes(contratoStatus);
};

/** Linha pending de contrato self-serve (resiliente a migration parcial). */
const fetchPendingContractFirstLine = async (adminClient, empresaId) => {
  const runQuery = async (select, withBillingFilter) => {
    let query = adminClient
      .from("empresa_mei_subscription_lines")
      .select(select)
      .eq("empresa_id", empresaId)
      .eq("status", "pending")
      .order("updated_at", { ascending: false })
      .limit(1);
    if (withBillingFilter) {
      query = query.eq("billing_type", "contract_first");
    }
    return query.maybeSingle();
  };

  let { data, error } = await runQuery(MEI_LINE_CONTRACT_SELECT_FULL, true);
  if (!error && isPendingContractFirstLine(data)) return data;

  if (error && isMissingApprovalColumnError(error)) {
    ({ data, error } = await runQuery(MEI_LINE_CONTRACT_SELECT_MIN, true));
    if (!error && isPendingContractFirstLine(data)) return data;
  }

  if (error) throw badRequest(error.message);

  ({ data, error } = await runQuery(MEI_LINE_CONTRACT_SELECT_FULL, false));
  if (!error && isPendingContractFirstLine(data)) return data;

  if (error && isMissingApprovalColumnError(error)) {
    ({ data, error } = await runQuery(MEI_LINE_CONTRACT_SELECT_MIN, false));
    if (!error && isPendingContractFirstLine(data)) return data;
  }

  if (error) throw badRequest(error.message);
  return null;
};

/** Status de cobrança da empresa do requester (gate /planos). */
export const getMeiBillingStatusForRequester = async (accessToken) => {
  const requester = await getRequesterContext(accessToken);
  if (requester.role === "superadmin") {
    return { required: false, maxMei: null, hasActiveSubscription: true, phase: "ok" };
  }
  if (requester.role !== "admin" || !requester.empresaId) {
    return { required: false, maxMei: null, hasActiveSubscription: false, phase: "ok" };
  }

  const billingMode =
    String(env.MEI_SELF_SERVE_BILLING_MODE || "contract_first").toLowerCase() ===
    "stripe"
      ? "stripe"
      : "contract_first";

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const empresaId = String(requester.empresaId);

  const { data: empresa, error } = await adminClient
    .from("empresas")
    .select("id, max_mei")
    .eq("id", empresaId)
    .maybeSingle();

  if (error) throw badRequest(error.message);

  const maxMei = Number(empresa?.max_mei || 0);
  const { data: activeLines } = await adminClient
    .from("empresa_mei_subscription_lines")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("status", "active")
    .limit(1);

  const hasActiveSubscription = Array.isArray(activeLines) && activeLines.length > 0;

  const contractFirstLine = await fetchPendingContractFirstLine(adminClient, empresaId);

  const awaitingContractSignature = Boolean(
    contractFirstLine?.id && contractFirstLine?.contrato_onety_id,
  );

  let phase = "ok";
  if (hasActiveSubscription || maxMei > 0) {
    phase = "ok";
  } else if (awaitingContractSignature || contractFirstLine?.id) {
    phase = "aguardando_contrato";
  } else {
    phase = "planos";
  }

  const required = !hasActiveSubscription && maxMei <= 0;

  return {
    required,
    maxMei,
    hasActiveSubscription,
    empresaId,
    billingMode,
    phase,
    packages: MEI_PUBLIC_PACKAGES,
    selfServeFunilId: getSelfServeFunil(env.ONETY_CRM_SELF_SERVE_FUNIL_ID)?.id
      ?? ONETY_CRM_SELF_SERVE_FUNIL_ID,
    contract: contractFirstLine
      ? {
          lineId: contractFirstLine.id,
          signingUrl: contractFirstLine.contrato_signing_url || null,
          contratoOnetyId: contractFirstLine.contrato_onety_id || null,
          contratoStatus: contractFirstLine.contrato_status || null,
          funilId: contractFirstLine.onety_funil_id || null,
          leadId: contractFirstLine.onety_lead_id || null,
          meiSlots: contractFirstLine.mei_slots || null,
        }
      : null,
  };
};

/** Funil CRM fixo do cadastro self-serve (Tráfego Pago). */
export const listMeiFunisForSelfServe = () => {
  const funil = getSelfServeFunil(env.ONETY_CRM_SELF_SERVE_FUNIL_ID);
  return {
    funilId: funil?.id ?? ONETY_CRM_SELF_SERVE_FUNIL_ID,
    funilName: funil?.name ?? "Tráfego Pago",
  };
};

/**
 * Self-serve sem Stripe: confirma vagas → CRM Tráfego Pago + contrato → aguarda assinatura.
 */
export const confirmMeiPlanContractFirstForRequester = async (
  accessToken,
  { meiSlots } = {},
) => {
  const requester = await getRequesterContext(accessToken);
  if (requester.role !== "admin" || !requester.empresaId) {
    throw forbidden("Somente admin da empresa pode contratar o plano.");
  }

  const slots = Number(meiSlots);
  const pricing = resolveMeiPricing(slots);
  const funil = getSelfServeFunil(env.ONETY_CRM_SELF_SERVE_FUNIL_ID);
  if (!funil?.faseLeadId || !funil?.fasePropostaId) {
    throw badRequest(
      "Funil Tráfego Pago (598) não está configurado para cadastro self-serve.",
    );
  }

  const empresaId = String(requester.empresaId);
  const adminClient = createSupabaseClient({ useServiceRole: true });

  const { data: activeLine } = await adminClient
    .from("empresa_mei_subscription_lines")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (activeLine?.id) {
    throw badRequest("Sua empresa já possui plano MEI ativo.");
  }

  const { data: pendingContract } = await adminClient
    .from("empresa_mei_subscription_lines")
    .select("id, contrato_onety_id, contrato_signing_url")
    .eq("empresa_id", empresaId)
    .eq("billing_type", "contract_first")
    .eq("status", "pending")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingContract?.contrato_onety_id) {
    return {
      ok: true,
      alreadyPending: true,
      lineId: pendingContract.id,
      signingUrl: pendingContract.contrato_signing_url || null,
      contratoOnetyId: pendingContract.contrato_onety_id,
    };
  }

  const corePayload = {
    id: randomUUID(),
    empresa_id: empresaId,
    mei_slots: slots,
    value_numeric: pricing.total,
    status: "pending",
    billing_type: "contract_first",
    onety_funil_id: funil.id,
    external_reference: randomUUID(),
  };

  const insertPayload = await buildMeiLineInsertPayload(adminClient, corePayload, {
    contrato_status: "awaiting_signature",
  });
  const line = await insertMeiSubscriptionLine(adminClient, insertPayload);
  if (!line?.id) throw badRequest("Não foi possível registrar o plano.");

  let crm = null;
  let leadId = null;
  try {
    crm = await prepararPropostaCrmForEmpresaOrThrow(adminClient, {
      empresaId,
      funilId: funil.id,
      valor: pricing.total,
    });
    leadId = crm?.dispatch?.response?.leadId ?? null;
  } catch (crmErr) {
    await updateMeiSubscriptionLine(adminClient, line.id, {
      contrato_status: "failed",
      contrato_error: crmErr instanceof Error ? crmErr.message : String(crmErr),
    });
    throw crmErr;
  }

  let contrato;
  try {
    contrato = await emitContratoForEmpresaOrThrow(adminClient, {
      empresaId,
      lineId: line.id,
      onetyLeadId: leadId ?? undefined,
    });
  } catch (contratoErr) {
    await updateMeiSubscriptionLine(adminClient, line.id, {
      contrato_status: "failed",
      contrato_error:
        contratoErr instanceof Error ? contratoErr.message : String(contratoErr),
    });
    throw contratoErr;
  }

  const meta = parseContratoWebhookMeta(contrato?.dispatch);
  let signingUrl = meta.signingUrl;
  const contratoOnetyId = meta.contratoId;

  if (!signingUrl && contratoOnetyId) {
    const check = await dispatchOnetyContratoStatusCheck(contratoOnetyId);
    if (check?.signingUrl) signingUrl = check.signingUrl;
  }

  await updateMeiSubscriptionLine(adminClient, line.id, {
    contrato_status: contratoOnetyId ? "sent" : "failed",
    contrato_sent_at: new Date().toISOString(),
    contrato_signing_url: signingUrl,
    contrato_onety_id: contratoOnetyId,
    onety_lead_id: leadId,
    onety_funil_id: funil.id,
    contrato_error: contratoOnetyId
      ? null
      : meta.mensagem || "Contrato gerado sem ID Onety",
  });

  if (!contratoOnetyId) {
    throw badRequest(
      meta.mensagem ||
        "Contrato enviado ao robô, mas o ID Onety não foi retornado.",
    );
  }

  return {
    ok: true,
    lineId: line.id,
    signingUrl,
    contratoOnetyId,
    leadId,
    funilId: funil.id,
    crm,
    contrato,
  };
};

/**
 * Polling: libera conta quando o contratante assina (parcial — antes de todas as partes).
 */
export const refreshMeiContractSignatureForRequester = async (accessToken) => {
  const requester = await getRequesterContext(accessToken);
  if (requester.role !== "admin" || !requester.empresaId) {
    throw forbidden();
  }

  const empresaId = String(requester.empresaId);
  const adminClient = createSupabaseClient({ useServiceRole: true });

  const line = await fetchPendingContractFirstLine(adminClient, empresaId);

  if (!line?.id) {
    return { ok: false, reason: "no_contract_line" };
  }

  if (line.status === "active") {
    return {
      ok: true,
      activated: true,
      clientSigned: true,
      signingUrl: line.contrato_signing_url || null,
      contratoOnetyId: line.contrato_onety_id || null,
    };
  }

  const contratoId = Number(line.contrato_onety_id);
  let resolvedContratoId =
    Number.isFinite(contratoId) && contratoId > 0 ? contratoId : null;

  if (!resolvedContratoId) {
    const leadId = Number(line.onety_lead_id);
    if (Number.isFinite(leadId) && leadId > 0) {
      const linkFetch = await dispatchOnetyContratoLinkFetch({ leadId });
      if (linkFetch.ok && linkFetch.contratoId) {
        resolvedContratoId = Number(linkFetch.contratoId);
        const recoveredUrl = linkFetch.signingUrl || null;
        if (resolvedContratoId || recoveredUrl) {
          await updateMeiSubscriptionLine(adminClient, line.id, {
            contrato_onety_id: resolvedContratoId,
            contrato_signing_url: recoveredUrl,
            contrato_status: recoveredUrl ? "sent" : line.contrato_status || "awaiting_signature",
          });
        }
        if (recoveredUrl) {
          return {
            ok: true,
            activated: false,
            clientSigned: Boolean(linkFetch.clientSigned),
            signingUrl: recoveredUrl,
            contratoOnetyId: resolvedContratoId,
            recoveredFromLead: true,
          };
        }
      }
    }
  }

  if (!resolvedContratoId) {
    return {
      ok: false,
      reason: "missing_contrato_id",
      signingUrl: line.contrato_signing_url || null,
    };
  }

  const check = await dispatchOnetyContratoStatusCheck(resolvedContratoId);
  if (!check.ok) {
    return {
      ok: true,
      activated: false,
      clientSigned: false,
      signingUrl: line.contrato_signing_url || check.signingUrl || null,
      contratoOnetyId: resolvedContratoId,
      pollError: check.reason || check.error,
    };
  }

  const signingUrl = check.signingUrl || line.contrato_signing_url || null;
  const patch = {
    contrato_signing_url: signingUrl,
  };

  if (check.clientSigned && line.status === "pending") {
    const signedAt = new Date().toISOString();
    await updateMeiSubscriptionLine(adminClient, line.id, {
      ...patch,
      status: "active",
      contrato_status: check.fullySigned ? "fully_signed" : "client_signed",
      contrato_client_signed_at: signedAt,
      approved_at: signedAt,
    });
    await syncEmpresaMaxMeiFromLines(adminClient, empresaId, { force: true });
    await activateEmpresaMeiAccessAfterPayment(adminClient, empresaId);

    return {
      ok: true,
      activated: true,
      clientSigned: true,
      fullySigned: Boolean(check.fullySigned),
      signingUrl,
      contratoOnetyId: resolvedContratoId,
    };
  }

  if (signingUrl && signingUrl !== line.contrato_signing_url) {
    await updateMeiSubscriptionLine(adminClient, line.id, patch);
  }

  return {
    ok: true,
    activated: false,
    clientSigned: Boolean(check.clientSigned),
    fullySigned: Boolean(check.fullySigned),
    signingUrl,
    contratoOnetyId: resolvedContratoId,
  };
};

/** Payload JSON contrato Onety (admin da empresa). */
export const getMeiContratoPayloadForRequester = async (accessToken) => {
  const requester = await getRequesterContext(accessToken);
  if (requester.role !== "admin" && requester.role !== "superadmin") {
    throw forbidden();
  }
  const empresaId = String(requester.empresaId || "").trim();
  if (!empresaId) throw badRequest("Empresa não vinculada ao utilizador");

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const payload = await buildStripeContratoPayloadForEmpresa(adminClient, {
    empresaId,
  });
  if (!payload) {
    throw badRequest(
      "Nenhuma assinatura MEI ativa encontrada para gerar o contrato",
    );
  }
  return payload;
};

/** Superadmin: diagnóstico do webhook de contrato (sem expor segredo). */
export const getMeiContratoWebhookStatusForAdmin = async (accessToken) => {
  const requester = await getRequesterContext(accessToken);
  if (requester.role !== "superadmin") throw forbidden();

  const url = String(env.ONETY_CONTRATO_WEBHOOK_URL || "").trim();
  let host = "";
  try {
    host = url ? new URL(url).host : "";
  } catch {
    host = "";
  }

  return {
    webhookConfigured: Boolean(url),
    webhookHost: host || null,
    webhookPath: url ? new URL(url).pathname : null,
    secretConfigured: Boolean(String(env.ONETY_CONTRATO_WEBHOOK_SECRET || "").trim()),
  };
};

/** Superadmin: signatário do contrato Onety (owner + admin da empresa). */
export const getContratoSignatarioForEmpresaAdmin = async (accessToken, empresaIdInput) => {
  const requester = await getRequesterContext(accessToken);
  if (requester.role !== "superadmin") throw forbidden();

  const empresaId = String(empresaIdInput || "").trim();
  if (!empresaId) throw badRequest("empresaId é obrigatório");

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const signatario = await resolveContratoSignatarioForEmpresa(adminClient, empresaId);
  if (!signatario) {
    throw badRequest(
      "Signatário não encontrado. Vincule um admin com e-mail ativo à empresa.",
    );
  }
  return { signatario };
};

/** Superadmin: gera e envia contrato Onety para empresa com assinatura ativa. */
export const emitMeiContratoForEmpresaAdmin = async (accessToken, input = {}) => {
  const requester = await getRequesterContext(accessToken);
  if (requester.role !== "superadmin") throw forbidden();

  const body = typeof input === "string" ? { empresaId: input } : input || {};
  const empresaId = String(body.empresaId || "").trim();
  if (!empresaId) throw badRequest("empresaId é obrigatório");

  const funilIdRaw = body.funilId;
  const funilId =
    funilIdRaw === null || funilIdRaw === undefined || funilIdRaw === ""
      ? null
      : Number(funilIdRaw);
  if (funilId !== null && (!Number.isFinite(funilId) || funilId <= 0)) {
    throw badRequest("funilId inválido");
  }

  const vendedorIdRaw = body.vendedorId;
  const vendedorId =
    vendedorIdRaw === null || vendedorIdRaw === undefined || vendedorIdRaw === ""
      ? null
      : Number(vendedorIdRaw);

  const valorRaw = body.valor;
  const valor =
    valorRaw === null || valorRaw === undefined || valorRaw === ""
      ? null
      : Number(valorRaw);

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data: activeLine, error } = await adminClient
    .from("empresa_mei_subscription_lines")
    .select("id, stripe_checkout_session_id, value_numeric")
    .eq("empresa_id", empresaId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw badRequest(error.message);
  if (!activeLine?.id) {
    throw badRequest("Nenhuma assinatura MEI ativa — reconcilie o pagamento antes de gerar o contrato.");
  }

  let crm = null;
  if (funilId) {
    const { getFunilById } = await import("../config/onety-crm-funis.js");
    const funil = getFunilById(funilId);
    if (!funil) {
      throw badRequest("Funil comercial inválido ou não habilitado para gerar contrato no FocoMEI.");
    }
    const { prepararPropostaCrmForEmpresaOrThrow } = await import("./onety-crm.service.js");
    crm = await prepararPropostaCrmForEmpresaOrThrow(adminClient, {
      empresaId,
      funilId,
      vendedorId,
      valor: valor ?? activeLine.value_numeric ?? undefined,
    });
  }

  const contrato = await emitContratoForEmpresaOrThrow(adminClient, {
    empresaId,
    lineId: activeLine.id,
    checkoutSessionId: activeLine.stripe_checkout_session_id || undefined,
    onetyLeadId: crm?.dispatch?.response?.leadId ?? undefined,
  });

  return { ...contrato, crm };
};

const PIX_IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;

const findExistingPixManualLine = async (
  adminClient,
  { empresaId, externalReference, meiSlots },
) => {
  const ref = String(externalReference || "").trim();
  if (ref) {
    const { data, error } = await adminClient
      .from("empresa_mei_subscription_lines")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("external_reference", ref)
      .maybeSingle();
    if (error) throw badRequest(error.message);
    if (data?.id) return data;
  }

  const since = new Date(Date.now() - PIX_IDEMPOTENCY_WINDOW_MS).toISOString();
  const { data: recent, error: recentErr } = await adminClient
    .from("empresa_mei_subscription_lines")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("billing_type", "pix_manual")
    .eq("status", "active")
    .eq("mei_slots", meiSlots)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recentErr) throw badRequest(recentErr.message);
  return recent?.id ? recent : null;
};

/**
 * Superadmin: cancela linha de pacote MEI (ex.: PIX duplicado) e recalcula max_mei.
 */
export const cancelMeiSubscriptionLineForEmpresa = async (accessToken, input = {}) => {
  const requester = await getRequesterContext(accessToken);
  if (requester.role !== "superadmin") throw forbidden();

  const lineId = String(input.lineId || "").trim();
  const empresaId = String(input.empresaId || "").trim();
  if (!lineId || !empresaId) {
    throw badRequest("lineId e empresaId são obrigatórios");
  }

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data: line, error: lineErr } = await adminClient
    .from("empresa_mei_subscription_lines")
    .select("id, empresa_id, status, billing_type, mei_slots")
    .eq("id", lineId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (lineErr) throw badRequest(lineErr.message);
  if (!line?.id) throw badRequest("Linha de pacote não encontrada para esta empresa");
  if (String(line.status || "").toLowerCase() === "cancelled") {
    throw badRequest("Este pacote já está cancelado");
  }

  const { error: upErr } = await adminClient
    .from("empresa_mei_subscription_lines")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", lineId);
  if (upErr) throw badRequest(upErr.message);

  let legacyPix = null;
  if (String(line.billing_type || "").toLowerCase() === "pix_manual") {
    const { data: empresa, error: empErr } = await adminClient
      .from("empresas")
      .select("legacy_mei_slots_pix")
      .eq("id", empresaId)
      .maybeSingle();
    if (empErr) throw badRequest(empErr.message);
    legacyPix = Math.max(
      0,
      Number(empresa?.legacy_mei_slots_pix || 0) - Number(line.mei_slots || 0),
    );
    await adminClient
      .from("empresas")
      .update({ legacy_mei_slots_pix: legacyPix })
      .eq("id", empresaId);
  }

  const maxMei = await syncEmpresaMaxMeiFromLines(adminClient, empresaId, {
    force: true,
  });

  return {
    lineId,
    cancelled: true,
    meiSlotsRemoved: Number(line.mei_slots || 0),
    maxMei,
    legacy_mei_slots_pix: legacyPix,
  };
};

/**
 * Superadmin: confirma pagamento PIX manual — libera /planos (max_mei + admin mei=true).
 * Cria linha `pix_manual` ativa (mesma tabela da Stripe para o gate de billing).
 */
export const confirmMeiPixPaymentForEmpresa = async (accessToken, input = {}) => {
  const requester = await getRequesterContext(accessToken);
  if (requester.role !== "superadmin") throw forbidden();

  const empresaId = String(input.empresaId || "").trim();
  if (!empresaId) throw badRequest("empresaId é obrigatório");

  const meiSlots = Number(input.meiSlots ?? 5);
  const pricing = resolveMeiPricing(meiSlots);
  if (!pricing) {
    throw badRequest(MEI_PRICING_INVALID_MESSAGE);
  }

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data: empresa, error: empErr } = await adminClient
    .from("empresas")
    .select("id, legacy_mei_slots_pix")
    .eq("id", empresaId)
    .maybeSingle();
  if (empErr) throw badRequest(empErr.message);
  if (!empresa?.id) throw badRequest("Empresa não encontrada");

  const description =
    String(input.description || "").trim()
    || `PIX manual — ${meiSlots} vagas MEI (R$ ${pricing.total.toFixed(2)}/mês)`;
  const externalReference =
    String(input.externalReference || "").trim() || randomUUID();
  const emitContrato = input.emitContrato !== false;
  const approvedAt = new Date().toISOString();

  const existingLine = await findExistingPixManualLine(adminClient, {
    empresaId,
    externalReference,
    meiSlots,
  });

  if (existingLine?.id) {
    const maxMei = await syncEmpresaMaxMeiFromLines(adminClient, empresaId, {
      force: true,
    });
    const activated = await activateEmpresaMeiAccessAfterPayment(
      adminClient,
      empresaId,
    );

    /** @type {Record<string, unknown>|null} */
    let contrato = null;
    const contratoStatus = String(existingLine.contrato_status || "").toLowerCase();
    const shouldEmitContrato =
      emitContrato && !["sent", "skipped"].includes(contratoStatus);

    if (shouldEmitContrato) {
      try {
        contrato = await emitContratoForEmpresaOrThrow(adminClient, {
          empresaId,
          lineId: existingLine.id,
        });
      } catch (error) {
        contrato = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return {
      line: existingLine,
      maxMei,
      activated,
      legacy_mei_slots_pix: Number(empresa.legacy_mei_slots_pix || 0),
      contrato,
      idempotent: true,
    };
  }

  const insertPayload = await buildMeiLineInsertPayload(
    adminClient,
    {
      empresa_id: empresaId,
      mei_slots: meiSlots,
      status: "active",
      value_numeric: pricing.total,
      billing_type: "pix_manual",
      external_reference: externalReference,
      description,
    },
    {
      approved_at: approvedAt,
      approved_by: requester.userId,
      contrato_status: emitContrato ? "pending" : "skipped",
    },
  );

  let row;
  try {
    row = await insertMeiSubscriptionLine(adminClient, insertPayload);
  } catch (insErr) {
    throw badRequest(insErr.message);
  }
  if (!row?.id) throw badRequest("Falha ao registrar pagamento PIX");

  const legacyPix = Number(empresa.legacy_mei_slots_pix || 0) + meiSlots;
  await adminClient
    .from("empresas")
    .update({ legacy_mei_slots_pix: legacyPix })
    .eq("id", empresaId);

  const maxMei = await syncEmpresaMaxMeiFromLines(adminClient, empresaId, {
    force: true,
  });
  const activated = await activateEmpresaMeiAccessAfterPayment(
    adminClient,
    empresaId,
  );

  /** @type {Record<string, unknown>|null} */
  let contrato = null;
  if (emitContrato) {
    try {
      contrato = await emitContratoForEmpresaOrThrow(adminClient, {
        empresaId,
        lineId: row.id,
      });
    } catch (error) {
      contrato = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    line: row,
    maxMei,
    activated,
    legacy_mei_slots_pix: legacyPix,
    contrato,
  };
};

/**
 * Após checkout: grava subscription id e status conforme assinatura na Stripe.
 */
export const finalizeMeiLineFromCheckoutSession = async (session) => {
  const sessionId = String(session?.id || "").trim();
  if (!sessionId) return { updated: false };

  const subRef = session.subscription;
  const subId =
    typeof subRef === "string" ? subRef : subRef?.id ? String(subRef.id) : "";

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data: existing, error: findErr } = await adminClient
    .from("empresa_mei_subscription_lines")
    .select("id, empresa_id")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (findErr || !existing?.id) return { updated: false };

  let status = "pending";
  if (subId) {
    try {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(subId);
      status = mapStripeSubscriptionStatus(sub.status);
    } catch {
      status = session.payment_status === "paid" ? "active" : "pending";
    }
  } else if (session.payment_status === "paid") {
    status = "active";
  }

  const statusPatch = {
    stripe_subscription_id: subId || null,
    status,
    ...(status === "active"
      ? {
          approved_at: new Date().toISOString(),
          contrato_status: "pending",
        }
      : {}),
  };

  try {
    await updateMeiSubscriptionLine(adminClient, existing.id, statusPatch);
  } catch (upErr) {
    throw badRequest(upErr.message);
  }

  await syncEmpresaMaxMeiFromLines(adminClient, existing.empresa_id, {
    force: true,
  });
  if (status === "active") {
    await activateEmpresaMeiAccessAfterPayment(
      adminClient,
      existing.empresa_id,
    );
    try {
      await emitOnetyContratoAfterStripePayment(adminClient, {
        empresaId: existing.empresa_id,
        checkoutSessionId: sessionId,
        lineId: existing.id,
      });
    } catch (err) {
      console.warn(
        "[onety-contrato] falha pós-checkout (pagamento já liberado):",
        err instanceof Error ? err.message : err,
      );
    }
  }
  return { updated: true, empresaId: existing.empresa_id };
};

/**
 * Atualiza linha pelo id da Subscription Stripe (webhook).
 */
export const touchSubscriptionLineByStripeSubscriptionId = async (
  stripeSubscriptionId,
  patch,
) => {
  const subId = String(stripeSubscriptionId || "").trim();
  if (!subId) return { updated: false };

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data: rows, error: findErr } = await adminClient
    .from("empresa_mei_subscription_lines")
    .select("id, empresa_id")
    .eq("stripe_subscription_id", subId);

  if (findErr || !rows?.length) return { updated: false };

  const ids = rows.map((r) => r.id);
  const empresaId = rows[0].empresa_id;

  const { error: upErr } = await adminClient
    .from("empresa_mei_subscription_lines")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);

  if (upErr) throw badRequest(upErr.message);

  await syncEmpresaMaxMeiFromLines(adminClient, empresaId, { force: true });
  if (String(patch?.status || "").toLowerCase() === "active") {
    await activateEmpresaMeiAccessAfterPayment(adminClient, empresaId);
  }
  return { updated: true, empresaId, rowsUpdated: ids.length };
};

export const syncMeiLineFromStripeSubscriptionObject = async (subscription) => {
  const subId = String(subscription?.id || "").trim();
  if (!subId) return { updated: false };

  const status = mapStripeSubscriptionStatus(subscription.status);
  return touchSubscriptionLineByStripeSubscriptionId(subId, { status });
};

const loadEmpresaBillingSnapshot = async (adminClient, empresaId) => {
  const id = String(empresaId || "").trim();
  if (!id) return null;

  const { data: empresa, error: empErr } = await adminClient
    .from("empresas")
    .select("id, status, max_mei, requested_by, stripe_customer_id")
    .eq("id", id)
    .maybeSingle();
  if (empErr) throw badRequest(empErr.message);

  const { data: lines, error: lineErr } = await adminClient
    .from("empresa_mei_subscription_lines")
    .select("id, status, mei_slots, stripe_checkout_session_id, stripe_subscription_id, updated_at")
    .eq("empresa_id", id)
    .order("created_at", { ascending: false });
  if (lineErr) throw badRequest(lineErr.message);

  let ownerAccess = null;
  const ownerId = String(empresa?.requested_by || "").trim();
  if (ownerId) {
    const { data: link } = await adminClient
      .from("role_x_user_x_empresa")
      .select("status, mei")
      .eq("user_id", ownerId)
      .eq("empresas_id", id)
      .maybeSingle();
    ownerAccess = link || null;
  }

  return {
    empresa: empresa || null,
    lines: lines || [],
    ownerAccess,
  };
};

/**
 * Superadmin: reprocessa pagamento Stripe (webhook perdido / acesso ou contrato não liberados).
 * @param {string} accessToken
 * @param {{ empresaId?: string, checkoutSessionId?: string, stripeSubscriptionId?: string, emitContrato?: boolean }} input
 */
export const reconcileMeiStripePayment = async (accessToken, input = {}) => {
  const requester = await getRequesterContext(accessToken);
  if (requester.role !== "superadmin") throw forbidden();

  let empresaId = String(input.empresaId || "").trim();
  let checkoutSessionId = String(input.checkoutSessionId || "").trim();
  let stripeSubscriptionId = String(input.stripeSubscriptionId || "").trim();
  const emitContrato = input.emitContrato !== false;

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const stripe = getStripe();
  /** @type {Record<string, unknown>[]} */
  const steps = [];

  if (!checkoutSessionId && !stripeSubscriptionId && empresaId) {
    const { data: lines, error } = await adminClient
      .from("empresa_mei_subscription_lines")
      .select("id, status, stripe_checkout_session_id, stripe_subscription_id")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw badRequest(error.message);

    const pendingWithSession = (lines || []).find(
      (line) => line.status !== "active" && line.stripe_checkout_session_id,
    );
    const activeWithSub = (lines || []).find(
      (line) => line.stripe_subscription_id,
    );

    if (pendingWithSession?.stripe_checkout_session_id) {
      checkoutSessionId = String(pendingWithSession.stripe_checkout_session_id);
      steps.push({
        step: "resolve_checkout_from_pending_line",
        lineId: pendingWithSession.id,
        checkoutSessionId,
      });
    } else if (activeWithSub?.stripe_subscription_id) {
      stripeSubscriptionId = String(activeWithSub.stripe_subscription_id);
      steps.push({
        step: "resolve_subscription_from_line",
        lineId: activeWithSub.id,
        stripeSubscriptionId,
      });
    }
  }

  if (checkoutSessionId) {
    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
      expand: ["subscription"],
    });
    steps.push({
      step: "retrieve_checkout_session",
      checkoutSessionId,
      paymentStatus: session.payment_status,
      mode: session.mode,
      subscriptionId:
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id || null,
    });

    if (session.mode === "subscription") {
      const finalized = await finalizeMeiLineFromCheckoutSession(session);
      steps.push({ step: "finalize_checkout_session", ...finalized });
      if (finalized.empresaId) empresaId = String(finalized.empresaId);
    } else {
      steps.push({
        step: "skip_finalize",
        reason: "checkout_mode_not_subscription",
      });
    }
  } else if (stripeSubscriptionId) {
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const synced = await syncMeiLineFromStripeSubscriptionObject(sub);
    steps.push({
      step: "sync_subscription",
      stripeSubscriptionId,
      stripeStatus: sub.status,
      ...synced,
    });
    if (synced.empresaId) empresaId = String(synced.empresaId);
  } else if (!empresaId) {
    throw badRequest(
      "Informe empresaId, checkoutSessionId ou stripeSubscriptionId",
    );
  }

  if (!empresaId) {
    throw badRequest(
      "Não foi possível identificar a empresa — informe empresaId ou checkoutSessionId",
    );
  }

  const { data: activeLines, error: activeErr } = await adminClient
    .from("empresa_mei_subscription_lines")
    .select("id, status, stripe_checkout_session_id")
    .eq("empresa_id", empresaId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (activeErr) throw badRequest(activeErr.message);

  const activeLine = activeLines?.[0] || null;
  if (activeLine) {
    await stampLineApprovalIfMissing(adminClient, activeLine.id, requester.userId);

    const activated = await activateEmpresaMeiAccessAfterPayment(
      adminClient,
      empresaId,
    );
    const maxMei = await syncEmpresaMaxMeiFromLines(adminClient, empresaId, {
      force: true,
    });
    steps.push({
      step: "ensure_access",
      activated,
      maxMei,
      activeLineId: activeLine.id,
    });

    if (emitContrato) {
      try {
        const contrato = await emitContratoForEmpresaOrThrow(adminClient, {
          empresaId,
          checkoutSessionId: activeLine.stripe_checkout_session_id || checkoutSessionId || undefined,
          lineId: activeLine.id,
        });
        steps.push({ step: "emit_contrato", ok: true, ...contrato });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        steps.push({ step: "emit_contrato", ok: false, error: message });
      }
    }
  } else {
    steps.push({
      step: "no_active_line",
      hint: "Pagamento pode estar pendente na Stripe ou linha sem stripe_checkout_session_id",
    });
  }

  const snapshot = await loadEmpresaBillingSnapshot(adminClient, empresaId);
  return {
    empresaId,
    steps,
    snapshot,
  };
};

const BILLING_TYPE_PIX = new Set(["pix_manual"]);
const BILLING_TYPE_CARD = new Set(["stripe_checkout", "stripe_next_cycle"]);

const normalizePaymentChannel = (billingType) => {
  const t = String(billingType || "").trim().toLowerCase();
  if (BILLING_TYPE_PIX.has(t)) return "pix";
  if (BILLING_TYPE_CARD.has(t)) return "card";
  return "other";
};

const paymentChannelLabel = (channel) => {
  if (channel === "pix") return "PIX manual";
  if (channel === "card") return "Cartão (Stripe)";
  return "Outro";
};

const contratoStatusLabel = (status) => {
  if (status === "sent") return "Contrato enviado";
  if (status === "failed") return "Contrato falhou";
  if (status === "pending") return "Contrato pendente";
  if (status === "skipped") return "Contrato não solicitado";
  return "Não registrado";
};

const userSummaryFromRow = (user) => {
  if (!user?.id) return null;
  const meta = user.raw_user_meta_data || user.user_metadata || {};
  return {
    id: user.id,
    email: user.email || null,
    displayName: meta.display_name || meta.name || meta.full_name || null,
  };
};

const loadUserSummariesByIds = async (adminClient, userIds = []) => {
  const ids = [...new Set(userIds.filter(Boolean))];
  const map = new Map();
  if (!ids.length) return map;

  const { data: rows, error } = await adminClient
    .from("users")
    .select("id, email, raw_user_meta_data")
    .in("id", ids);

  if (!error && rows?.length) {
    for (const row of rows) {
      const summary = userSummaryFromRow(row);
      if (summary) map.set(summary.id, summary);
    }
  }

  const missing = ids.filter((id) => !map.has(id));
  for (const userId of missing) {
    try {
      const { data: authData } = await adminClient.auth.admin.getUserById(userId);
      const summary = userSummaryFromRow(authData?.user);
      if (summary) map.set(userId, summary);
    } catch {
      // ignore
    }
  }

  return map;
};

const buildReleasedByLabel = ({ approver, paymentChannel }) => {
  if (approver?.displayName && approver?.email) {
    return `${approver.displayName} · ${approver.email}`;
  }
  if (approver?.displayName) return approver.displayName;
  if (approver?.email) return approver.email;
  if (paymentChannel === "pix") return "Não registrado (liberação anterior)";
  if (paymentChannel === "card") return "Stripe (automático)";
  return "—";
};

const stampLineApprovalIfMissing = async (adminClient, lineId, userId) => {
  if (!lineId || !userId) return;
  const supported = await hasMeiLineApprovalColumns(adminClient);
  if (!supported) return;

  await adminClient
    .from("empresa_mei_subscription_lines")
    .update({
      approved_by: userId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", lineId)
    .is("approved_by", null);
};

/**
 * Superadmin: fila global de aprovações MEI (PIX, cartão, contrato, acesso liberado).
 */
export const listMeiPaymentApprovalsForAdmin = async (accessToken, queryParams = {}) => {
  const requester = await getRequesterContext(accessToken);
  if (requester.role !== "superadmin") throw forbidden();

  const statusFilter = String(queryParams.status || "").trim().toLowerCase();
  const paymentChannel = String(queryParams.paymentChannel || "").trim().toLowerCase();
  const contratoFilter = String(queryParams.contratoStatus || "").trim().toLowerCase();
  const accessFilter = String(queryParams.accessReleased || "").trim().toLowerCase();
  const searchTerm = String(queryParams.search || "").trim().toLowerCase();

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const approvalColumnsSupported = await hasMeiLineApprovalColumns(adminClient);
  let lineQuery = adminClient
    .from("empresa_mei_subscription_lines")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (statusFilter && ["pending", "active", "cancelled"].includes(statusFilter)) {
    lineQuery = lineQuery.eq("status", statusFilter);
  }
  if (paymentChannel === "pix") {
    lineQuery = lineQuery.eq("billing_type", "pix_manual");
  } else if (paymentChannel === "card") {
    lineQuery = lineQuery.in("billing_type", ["stripe_checkout", "stripe_next_cycle"]);
  }
  if (approvalColumnsSupported && contratoFilter && ["pending", "sent", "failed", "skipped"].includes(contratoFilter)) {
    if (contratoFilter === "pending") {
      lineQuery = lineQuery.or("contrato_status.eq.pending,contrato_status.is.null");
    } else {
      lineQuery = lineQuery.eq("contrato_status", contratoFilter);
    }
  }

  const { data: lines, error: linesErr } = await lineQuery;
  if (linesErr) throw badRequest(linesErr.message);

  const rawLines = lines || [];
  if (!rawLines.length) {
    return { items: [], summary: { total: 0, pix: 0, card: 0, accessReleased: 0, contratoSent: 0 } };
  }

  const empresaIds = [...new Set(rawLines.map((l) => l.empresa_id).filter(Boolean))];
  const { data: empresas, error: empErr } = await adminClient
    .from("empresas")
    .select("id, empresa, nome_fantasia, cnpj, max_mei, requested_by, legacy_mei_slots_pix")
    .in("id", empresaIds);
  if (empErr) throw badRequest(empErr.message);

  const empresaMap = new Map((empresas || []).map((e) => [e.id, e]));
  const ownerIds = [...new Set((empresas || []).map((e) => e.requested_by).filter(Boolean))];

  const ownerLinkMap = new Map();

  if (ownerIds.length) {
    const { data: ownerLinks, error: linkErr } = await adminClient
      .from("role_x_user_x_empresa")
      .select("user_id, empresas_id, status, mei")
      .in("user_id", ownerIds);
    if (linkErr) throw badRequest(linkErr.message);
    for (const link of ownerLinks || []) {
      ownerLinkMap.set(`${link.user_id}:${link.empresas_id}`, link);
    }
  }

  const approverIds = [...new Set(rawLines.map((l) => l.approved_by).filter(Boolean))];
  const userSummaryMap = await loadUserSummariesByIds(
    adminClient,
    [...ownerIds, ...approverIds],
  );

  let items = rawLines.map((line) => {
    const empresa = empresaMap.get(line.empresa_id) || null;
    const ownerId = String(empresa?.requested_by || "").trim();
    const ownerLink = ownerId && empresa?.id
      ? ownerLinkMap.get(`${ownerId}:${empresa.id}`)
      : null;
    const ownerUser = ownerId ? userSummaryMap.get(ownerId) : null;
    const approver = line.approved_by ? userSummaryMap.get(line.approved_by) : null;
    const channel = normalizePaymentChannel(line.billing_type);
    const accessReleased = Boolean(ownerLink?.status !== false && ownerLink?.mei === true);
    const releasedByLabel = buildReleasedByLabel({ approver, paymentChannel: channel });

    return {
      lineId: line.id,
      empresaId: line.empresa_id,
      empresaName: empresa?.nome_fantasia || empresa?.empresa || "—",
      empresaCnpj: empresa?.cnpj || null,
      meiSlots: line.mei_slots,
      valueNumeric: line.value_numeric,
      lineStatus: line.status,
      billingType: line.billing_type,
      paymentChannel: channel,
      paymentChannelLabel: paymentChannelLabel(channel),
      description: line.description || null,
      approvedAt: line.approved_at || (line.status === "active" ? line.updated_at : null),
      approvedBy: line.approved_by || null,
      approvedByEmail: approver?.email || null,
      approvedByName: approver?.displayName || null,
      releasedByLabel,
      contratoStatus: line.contrato_status || null,
      contratoStatusLabel: contratoStatusLabel(line.contrato_status),
      contratoSentAt: line.contrato_sent_at || null,
      contratoError: line.contrato_error || null,
      accessReleased,
      ownerId: ownerId || null,
      ownerEmail: ownerUser?.email || null,
      ownerDisplayName: ownerUser?.displayName || null,
      maxMei: empresa?.max_mei ?? null,
      legacyMeiSlotsPix: empresa?.legacy_mei_slots_pix ?? null,
      createdAt: line.created_at,
      updatedAt: line.updated_at,
    };
  });

  if (accessFilter === "yes") {
    items = items.filter((item) => item.accessReleased);
  } else if (accessFilter === "no") {
    items = items.filter((item) => !item.accessReleased);
  }

  if (searchTerm) {
    items = items.filter((item) => {
      const haystack = [
        item.empresaName,
        item.empresaCnpj,
        item.ownerEmail,
        item.ownerDisplayName,
        item.description,
        item.approvedByEmail,
        item.approvedByName,
        item.releasedByLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchTerm);
    });
  }

  const summary = {
    total: items.length,
    pix: items.filter((i) => i.paymentChannel === "pix").length,
    card: items.filter((i) => i.paymentChannel === "card").length,
    accessReleased: items.filter((i) => i.accessReleased).length,
    contratoSent: items.filter((i) => i.contratoStatus === "sent").length,
    contratoFailed: items.filter((i) => i.contratoStatus === "failed").length,
    contratoPending: items.filter((i) => !i.contratoStatus || i.contratoStatus === "pending").length,
  };

  return { items, summary };
};
