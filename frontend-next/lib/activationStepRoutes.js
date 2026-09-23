const ROUTE_TO_HREF = {
  'settings:profile': '/minha-conta',
  'settings:phone': '/minha-conta',
  'settings:google': '/minha-conta?google=1#google-agenda',
  'contas:new': '/contas?nova=1',
  'transactions:new': '/transacoes?nova=1',
  orcamentos: '/orcamentos?novo=1',
  'mei:certificate': '/notas/certificado',
  'mei:das': '/notas/das',
  'mei:nfse': '/notas/notas-fiscais',
};

export function activationRouteToHref(route) {
  return ROUTE_TO_HREF[route] ?? null;
}
