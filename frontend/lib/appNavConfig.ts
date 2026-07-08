import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { AppScreenName } from './navigationContext';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type AppNavItem = {
  screen: AppScreenName;
  label: string;
  icon: IoniconName;
  activeIcon: IoniconName;
  /** Exibido na barra superior (web) */
  showInTopNav?: boolean;
  /** Exibido na tab bar inferior (native) */
  showInBottomNav?: boolean;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    screen: 'MeuMei',
    label: 'Meu MEI',
    icon: 'briefcase-outline',
    activeIcon: 'briefcase',
    showInTopNav: true,
    showInBottomNav: true,
  },
  {
    screen: 'Configuracoes',
    label: 'Configurações',
    icon: 'settings-outline',
    activeIcon: 'settings',
  },
];

export const SCREEN_TO_HREF: Record<AppScreenName, string> = {
  MeuMei: '/(app)/',
  Configuracoes: '/(app)/configuracoes',
};

const PATH_SUFFIX_TO_SCREEN: Record<string, AppScreenName> = {
  '': 'MeuMei',
  '/': 'MeuMei',
  '/index': 'MeuMei',
  '/mei': 'MeuMei',
  '/configuracoes': 'Configuracoes',
};

/** Rotas legadas do financeiro pessoal → home MEI. */
const LEGACY_FINANCE_PATHS = new Set([
  '/transacoes',
  '/contas',
  '/conta-global',
  '/categorias',
  '/orcamentos',
  '/agenda',
]);

/** Normaliza pathname do Expo Router para `AppScreenName`. */
export function resolveAppScreenFromPath(pathname?: string | null): AppScreenName {
  const stripped = String(pathname ?? '/')
    .replace(/^\/?\(app\)/, '')
    .replace(/\/$/, '')
    .split('?')[0];
  const suffix = stripped === '' ? '/' : stripped.startsWith('/') ? stripped : `/${stripped}`;

  if (suffix === '/configuracoes' || suffix.startsWith('/configuracoes/')) {
    return 'Configuracoes';
  }
  if (suffix === '/solicitacoes') {
    return 'Configuracoes';
  }
  if (LEGACY_FINANCE_PATHS.has(suffix)) {
    return 'MeuMei';
  }

  return PATH_SUFFIX_TO_SCREEN[suffix] ?? 'MeuMei';
}

export function filterNavItems(items: AppNavItem[]): AppNavItem[] {
  return items;
}
