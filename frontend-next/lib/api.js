/**
 * Compatibilidade temporária para os portes iniciais da Visão Geral.
 * Toda chamada usa a implementação única de `apiClient`.
 */
export {
  apiClient,
  ApiError,
  NotAuthenticatedError,
  isAbortError,
} from './apiClient.js';
