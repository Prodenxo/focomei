import { resolveAppOrigin } from '@/lib/appOrigin';
import { fetchMeiBillingStatus } from '@/lib/billingApi';
import {
  clearMeiContractPendingSession,
  hasMeiContractPendingSession,
  readMeiContractPendingSession,
} from '@/lib/meiContractPendingSession';

function inferPhase(status) {
  if (status?.phase) return status.phase;
  if (status?.required === false) return 'ok';
  if (status?.contract?.lineId || status?.contract?.contratoOnetyId
    || status?.contract?.signingUrl) {
    return 'aguardando_contrato';
  }
  return 'planos';
}

export async function fetchMeiBillingGateStatus(role, mei, userId) {
  if (resolveAppOrigin() === 'focosimples') return null;
  if (role === 'superadmin' || role !== 'admin') {
    return { required: false, phase: 'ok', hasActiveSubscription: role === 'superadmin' };
  }

  try {
    const serverStatus = await fetchMeiBillingStatus();
    const status = { ...serverStatus, phase: inferPhase(serverStatus) };
    const pending = readMeiContractPendingSession(userId);

    if (status.phase === 'ok' || status.hasActiveSubscription || status.required === false) {
      clearMeiContractPendingSession(userId);
      return status;
    }

    const hasServerContract = Boolean(
      status.contract?.lineId
      || status.contract?.contratoOnetyId
      || status.contract?.signingUrl,
    );

    if (status.phase === 'planos' && !hasServerContract) {
      clearMeiContractPendingSession(userId);
      return status;
    }

    if (hasMeiContractPendingSession(pending)) {
      return {
        ...status,
        required: true,
        phase: 'aguardando_contrato',
        contract: {
          ...status.contract,
          lineId: pending.lineId || status.contract?.lineId,
          signingUrl: pending.signingUrl || status.contract?.signingUrl || null,
          contratoOnetyId: pending.contratoOnetyId || status.contract?.contratoOnetyId || null,
        },
      };
    }

    return status;
  } catch {
    const pending = readMeiContractPendingSession(userId);
    if (hasMeiContractPendingSession(pending)) {
      return {
        required: true,
        phase: 'aguardando_contrato',
        hasActiveSubscription: false,
        contract: pending,
      };
    }
    return {
      required: mei !== true,
      phase: mei !== true ? 'planos' : 'ok',
      hasActiveSubscription: false,
    };
  }
}

export async function shouldRequireMeiBillingRoute(role, mei, userId) {
  return Boolean(await resolveMeiBillingHref(role, mei, userId));
}

export async function resolveMeiBillingHref(role, mei, userId) {
  const status = await fetchMeiBillingGateStatus(role, mei, userId);
  if (!status) return null;
  if (status.phase === 'aguardando_contrato') return '/aguardando-contrato';
  if (status.phase === 'planos') return '/planos';
  return null;
}
