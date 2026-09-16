import { resolveAppOrigin } from '@/lib/appOrigin';
import { fetchMeiBillingStatus } from '@/lib/billingApi';

export async function shouldRequireMeiBillingRoute(role, mei) {
  return Boolean(await resolveMeiBillingHref(role, mei));
}

export async function resolveMeiBillingHref(role, mei) {
  if (resolveAppOrigin() === 'focosimples') return null;
  if (role === 'superadmin' || role !== 'admin') return null;
  try {
    const status = await fetchMeiBillingStatus();
    if (status?.phase === 'aguardando_contrato' || status?.contract?.lineId
      || status?.contract?.contratoOnetyId || status?.contract?.signingUrl) {
      return '/aguardando-contrato';
    }
    if (status?.required) return '/planos';
    if (status && status.required === false && (status.maxMei ?? 0) > 0) {
      return mei !== true ? '/planos' : null;
    }
    return null;
  } catch {
    return mei !== true ? '/planos' : null;
  }
}
