export const PUBLIC_HOME_HREF = '/';
export const APP_HOME_HREF = '/visao-geral';
export const LOGIN_HREF = '/login';
export const ACCESS_REQUEST_HREF = '/solicitar-acesso';

export function resolveRootHref(isAuthenticated) {
  return isAuthenticated ? APP_HOME_HREF : PUBLIC_HOME_HREF;
}

export function isAppHomePath(pathname) {
  return pathname === APP_HOME_HREF || pathname.startsWith(`${APP_HOME_HREF}/`);
}
