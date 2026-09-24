import { isValidEmpresaCnpj } from '@/lib/empresaCnpj';
import {
  fetchEmpresaCnpjOnboardingStatus,
  getCurrentEmpresa,
} from '@/lib/empresaOnboardingApi';

export async function isEmpresaCnpjOnboardingRequired(role, mei) {
  if (role !== 'admin' || mei !== true) return false;
  try {
    const status = await fetchEmpresaCnpjOnboardingStatus();
    if (status !== null) return Boolean(status.required);
  } catch {
    return false;
  }
  try {
    const empresa = await getCurrentEmpresa();
    if (!empresa) return false;
    return !isValidEmpresaCnpj(empresa.cnpj);
  } catch {
    return false;
  }
}
