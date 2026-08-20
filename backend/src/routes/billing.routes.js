import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import * as stripeBillingService from '../services/stripe-billing.service.js';
import { unlockPendingSelfServeSignup } from '../services/self-serve-signup.service.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

const router = Router();

/** Pacotes + se a empresa do admin ainda precisa pagar. */
router.get('/mei/status', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const data = await stripeBillingService.getMeiBillingStatusForRequester(
      req.accessToken,
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
});

/**
 * Libera cadastro antigo preso em "Solicitação em análise"
 * (status=false da edge function) → admin ativo aguardando /planos.
 */
router.post('/mei/unlock-pending', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }
    const data = await unlockPendingSelfServeSignup(userId);
    return sendSuccess(
      res,
      data,
      data.unlocked ? 'Acesso liberado para escolher o plano' : 'OK',
    );
  } catch (error) {
    return next(error);
  }
});

/** Checkout self-serve (admin da própria empresa). */
router.post('/mei/checkout', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const data = await stripeBillingService.createMeiStripeCheckoutSession(
      req.accessToken,
      {
        ...req.body,
        billingTiming: 'checkout',
      },
    );
    return sendCreated(
      res,
      data,
      'Checkout Stripe criado — conclua o pagamento para liberar o Meu MEI',
    );
  } catch (error) {
    return next(error);
  }
});

/** Funil CRM fixo do self-serve (Tráfego Pago 598). */
router.get('/mei/funis', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const data = stripeBillingService.listMeiFunisForSelfServe();
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
});

/** Confirma plano MEI sem Stripe — gera contrato e aguarda assinatura. */
router.post('/mei/confirm-plan', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const data = await stripeBillingService.confirmMeiPlanContractFirstForRequester(
      req.accessToken,
      req.body,
    );
    return sendCreated(res, data, 'Contrato gerado — assine para liberar sua conta');
  } catch (error) {
    return next(error);
  }
});

/** Polling: verifica assinatura do contratante e libera conta. */
router.post('/mei/contrato/refresh-signature', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const data = await stripeBillingService.refreshMeiContractSignatureForRequester(
      req.accessToken,
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
});

/** JSON de contrato Onety (empresa do admin, linha Stripe ativa). */
router.get('/mei/contrato-payload', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const data = await stripeBillingService.getMeiContratoPayloadForRequester(
      req.accessToken,
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
});

export default router;
