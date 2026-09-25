/**
 * Mensagem curta para erros do cadastro empresa PlugNotas (sem textão repetitivo).
 */
import { neutralizeProviderNames } from './providerNeutralText.js';

export function shortPlugNotasEmpresaError(raw) {
  const text = neutralizeProviderNames(raw).trim();
  if (!text) return 'O emissor fiscal recusou o cadastro.';

  const lower = text.toLowerCase();
  if (lower.includes('homologad')) {
    return 'O emissor fiscal recusou o cadastro do município. Confira o código IBGE e a opção NFS-e Nacional; se persistir, solicite a liberação do CNPJ no emissor.';
  }
  if (lower.includes('codigoibgecidade') && lower.includes('tabela')) {
    return 'Código IBGE da cidade não aceito pelo emissor. Confira os 7 dígitos (ex.: 3300159).';
  }
  if (text.length > 220) {
    return `${text.slice(0, 220)}…`;
  }
  return text;
}

/** @deprecated use shortPlugNotasEmpresaError */
export function humanizePlugNotasEmpresaError(raw) {
  return shortPlugNotasEmpresaError(raw);
}
