import { legacyHref } from '@/lib/env';

/**
 * Mesma ordem e rótulos de `frontend/lib/appNavConfig.ts`. As URLs apontam para o
 * app Expo atual — só a Visão Geral vive aqui.
 */
const NAV_ITEMS = [
  { id: 'Dashboard', label: 'Visão Geral', href: '/visao-geral', interno: true },
  { id: 'Transacoes', label: 'Transações', href: '/transacoes' },
  { id: 'Contas', label: 'Contas', href: '/contas' },
  { id: 'ContaGlobal', label: 'Conta global', href: '/conta-global' },
  { id: 'Categorias', label: 'Categorias', href: '/categorias' },
  { id: 'Orcamentos', label: 'Orçamentos', href: '/orcamentos' },
  { id: 'Agenda', label: 'Agenda', href: '/agenda' },
  { id: 'MeuMei', label: 'Meu MEI', href: '/mei', exigeMei: true },
];

export const CONFIGURACOES_HREF = '/configuracoes';
export const LOGIN_HREF = '/login';

/** Resolve o destino final: interno fica relativo, o resto vai para o app antigo. */
export function resolveNavHref(item) {
  return item.interno ? item.href : legacyHref(item.href);
}

export function buildNavItems(podeVerMei) {
  return NAV_ITEMS.filter((item) => !item.exigeMei || podeVerMei).map((item) => ({
    ...item,
    url: resolveNavHref(item),
  }));
}
