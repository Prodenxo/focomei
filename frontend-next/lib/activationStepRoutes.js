const ROUTE_TO_HREF = {
  'settings:profile': '/minha-conta',
  'settings:phone': '/minha-conta',
  'settings:google': '/minha-conta',
  'contas:new': '/contas',
  'transactions:new': '/transacoes?nova=1',
  orcamentos: '/orcamentos',
  'mei:certificate': '/notas/certificado',
  'mei:das': '/notas/das',
  'mei:nfse': '/notas/notas-fiscais',
};

export function activationRouteToHref(route) {
  return ROUTE_TO_HREF[route] ?? null;
}
