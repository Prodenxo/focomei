'use client';

import { useId, useMemo } from 'react';
import { Icone } from '@/components/ui/Icone';
import { formatarReal } from '@/lib/finance/dashboardUtils';
import { caminhoSuave, escalaPontos, fecharArea } from '@/lib/grafico';
import estilos from './CartaoSaldo.module.css';

const LARGURA = 220;
const ALTURA = 96;

function Onda({ serie }) {
  const idGradiente = useId();
  const caminho = useMemo(() => {
    if (serie.length < 2) return null;
    const pontos = escalaPontos(serie, { largura: LARGURA, altura: ALTURA, margemTopo: 8, margemBase: 0 });
    const linha = caminhoSuave(pontos);
    return { linha, area: fecharArea(linha, pontos, ALTURA) };
  }, [serie]);

  if (!caminho) return null;

  return (
    <svg
      className={estilos.onda}
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0e9f6e" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <path d={caminho.area} fill={`url(#${idGradiente})`} />
      <path d={caminho.linha} fill="none" stroke="#6ee7b7" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Saldo é o número que o MEI abre o app para ver: fundo marinho, número grande e a
 * própria curva do mês sangrando até a borda — o mesmo dado, em duas leituras.
 */
export function CartaoSaldo({
  rotulo,
  dica,
  valor,
  serie = [],
  carregando,
  visivel,
  aoAlternarVisibilidade,
  atualizadoEm,
}) {
  return (
    <div className={estilos.cartao}>
      <Onda serie={serie} />

      <div className={estilos.topo}>
        <span className={estilos.rotulo}>{rotulo}</span>
        <button
          type="button"
          className={estilos.olho}
          onClick={aoAlternarVisibilidade}
          aria-label={visivel ? 'Ocultar saldo' : 'Mostrar saldo'}
        >
          <Icone nome={visivel ? 'olho' : 'olhoFechado'} tamanho={16} />
        </button>
      </div>

      {carregando ? (
        <span className={estilos.esqueletoClaro} style={{ width: 200, height: 34, margin: '8px 0 6px' }} />
      ) : (
        <p className={`${estilos.valor} ${visivel ? '' : estilos.oculto} numero`}>
          {visivel ? formatarReal(valor) : '••••••'}
        </p>
      )}

      <p className={estilos.rodape}>{carregando ? 'Carregando…' : atualizadoEm || dica}</p>
    </div>
  );
}
