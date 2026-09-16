/**
 * Conjunto único de ícones (traço 1.6, cantos arredondados). Ícone aqui esclarece,
 * não decora: cada um marca um tipo de dado ou uma ação.
 */
const TRACOS = {
  casa: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5',
  troca: 'M7 7h13l-3-3M17 17H4l3 3',
  cartao: 'M2.5 6.5h19v11h-19zM2.5 10.5h19',
  globo: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18',
  grade: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  carteira: 'M3 7.5A2.5 2.5 0 0 1 5.5 5H19v3M3 7.5V18a2 2 0 0 0 2 2h14v-4M3 7.5H19v8.5M16 12h3',
  agenda: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  maleta: 'M3 8h18v12H3zM9 8V5h6v3',
  engrenagem:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 13.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1.1',
  lua: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5',
  sol: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 2v2M12 20v2M4.2 4.2l1.5 1.5M18.3 18.3l1.5 1.5M2 12h2M20 12h2M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5',
  sair: 'M15 17l5-5-5-5M20 12H9M11 4H5v16h6',
  esquerda: 'M15 5l-7 7 7 7',
  direita: 'M9 5l7 7-7 7',
  baixo: 'M5 9l7 7 7-7',
  mais: 'M12 5v14M5 12h14',
  setaCima: 'M12 19V5M6 11l6-6 6 6',
  setaBaixo: 'M12 5v14M6 13l6 6 6-6',
  setaDireita: 'M5 12h14M13 6l6 6-6 6',
  olho: 'M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  olhoFechado: 'M3 3l18 18M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2M6.3 6.6C3.8 8.2 2 12 2 12s3.6 6 10 6c1.8 0 3.4-.5 4.7-1.2M21.9 12.4C21.2 11 18.2 6 12 6c-.5 0-1 0-1.5.1',
  pessoas:
    'M16.5 20v-1.8a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 18.2V20M9.7 11.2a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2M21 20v-1.8a3.6 3.6 0 0 0-2.7-3.5M15.5 4.1a3.6 3.6 0 0 1 0 7',
  grafico: 'M3 20h18M6 16V9M11 16V5M16 16v-4M21 16v-7',
  linha: 'M3 17l5-6 4 3 5-7 4 4',
  relogio: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3.5 2',
  recibo: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  alerta: 'M12 3l9.5 17H2.5zM12 9v5M12 17.5h.01',
  lista: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  calendario: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  atualizar: 'M20 11a8 8 0 1 0-1.3 5.4M20 5v6h-6',
  busca: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3',
  fechar: 'M6 6l12 12M18 6L6 18',
  documento: 'M6 3h8l4 4v14H6zM14 3v4h4',
  entrada: 'M12 19V5M6 11l6-6 6 6',
  saida: 'M12 5v14M6 13l6 6 6-6',
  raio: 'M13 2 4 14h7l-1 8 9-12h-7z',
};

export function Icone({ nome, tamanho = 18, className, ...resto }) {
  const traco = TRACOS[nome];
  if (!traco) return null;

  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...resto}
    >
      <path d={traco} />
    </svg>
  );
}
