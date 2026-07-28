import { apiClient } from '../lib/apiClient';
import type { NfsePrestadorPrefillDto } from '../lib/nfsePrestadorPrefillDto';

const emptyPrefill = (): NfsePrestadorPrefillDto => ({
  prestadorCpfCnpj: null,
  prestadorRazaoSocial: null,
  prestadorEmail: null,
  prestadorInscricaoMunicipal: null,
  prestadorEndereco: null,
  sourceRowId: null,
});

/**
 * Prefill NFSe a partir de `user_mei_certificates` via API do backend
 * (`GET /mei-guide/prestador-prefill`). Compatível com AUTH_MODE=local.
 */
export async function fetchNfsePrestadorPrefill(): Promise<NfsePrestadorPrefillDto> {
  try {
    const data = await apiClient.get<{ prefill?: NfsePrestadorPrefillDto }>(
      '/mei-guide/prestador-prefill',
    );
    return data?.prefill ?? emptyPrefill();
  } catch (err) {
    const message =
      err instanceof Error && err.message.trim()
        ? err.message
        : 'Não foi possível carregar dados do prestador';
    throw new Error(message);
  }
}
