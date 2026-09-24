/** Geometria dos gráficos em SVG — sem biblioteca externa. */

export function escalaPontos(valores, { largura, altura, margemTopo = 0, margemBase = 0 }) {
  if (!valores.length) return [];

  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const amplitude = max - min || Math.abs(max) || 1;
  const util = altura - margemTopo - margemBase;
  const passo = valores.length > 1 ? largura / (valores.length - 1) : 0;

  return valores.map((valor, indice) => ({
    x: valores.length > 1 ? indice * passo : largura / 2,
    y: margemTopo + util - ((valor - min) / amplitude) * util,
    valor,
  }));
}

/** Curva suave (Catmull-Rom convertida em Bézier) — o saldo é contínuo, não serrilhado. */
export function caminhoSuave(pontos, tensao = 0.22) {
  if (pontos.length < 2) return '';

  let d = `M ${pontos[0].x} ${pontos[0].y}`;
  for (let i = 0; i < pontos.length - 1; i += 1) {
    const p0 = pontos[i - 1] || pontos[i];
    const p1 = pontos[i];
    const p2 = pontos[i + 1];
    const p3 = pontos[i + 2] || p2;

    const c1x = p1.x + (p2.x - p0.x) * tensao;
    const c1y = p1.y + (p2.y - p0.y) * tensao;
    const c2x = p2.x - (p3.x - p1.x) * tensao;
    const c2y = p2.y - (p3.y - p1.y) * tensao;

    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function fecharArea(caminho, pontos, altura) {
  if (!caminho) return '';
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  return `${caminho} L ${ultimo.x} ${altura} L ${primeiro.x} ${altura} Z`;
}

/** Marcas do eixo Y arredondadas para valores legíveis. */
export function marcasEixo(valores, quantidade = 5) {
  if (!valores.length) return [];
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  if (min === max) return [min];

  const passo = (max - min) / (quantidade - 1);
  return Array.from({ length: quantidade }, (_, i) => min + passo * i);
}

export function abreviarValor(valor) {
  const absoluto = Math.abs(valor);
  if (absoluto >= 1_000_000) return `${(valor / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  if (absoluto >= 1_000) return `${Math.round(valor / 1_000)} mil`;
  return String(Math.round(valor));
}
