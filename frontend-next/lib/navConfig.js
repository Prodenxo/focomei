import {
  Briefcase,
  Calendar,
  Globe,
  Home,
  LayoutGrid,
  Receipt,
  Wallet,
} from 'lucide-react';
import { APP_HOME_HREF, isAppHomePath } from '@/lib/appRoutes';

/** Mapeamento Expo → Next.js (rotas explícitas de migração). */
export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Visão geral', href: APP_HOME_HREF, icon: Home },
  { id: 'transacoes', label: 'Transações', href: '/transacoes', icon: Receipt },
  { id: 'contas', label: 'Contas', href: '/contas', icon: Wallet },
  { id: 'conta-global', label: 'Conta global', href: '/conta-global', icon: Globe },
  { id: 'categorias', label: 'Categorias', href: '/categorias', icon: LayoutGrid },
  { id: 'orcamentos', label: 'Orçamentos', href: '/orcamentos', icon: Wallet },
  { id: 'agenda', label: 'Agenda', href: '/agenda', icon: Calendar },
  {
    id: 'notas',
    label: 'Meu MEI',
    href: '/notas',
    icon: Briefcase,
    requiresFiscalAccess: true,
  },
];

export function isNavActive(pathname, href) {
  if (href === APP_HOME_HREF) return isAppHomePath(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}
