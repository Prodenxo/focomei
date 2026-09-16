'use client';

import { useId, useMemo, useState } from 'react';
import { Cartao, CartaoCabecalho } from '@/components/ui/Cartao';
import { Esqueleto, EstadoVazio } from '@/components/ui/Estados';
import { MESES_CURTOS, formatarReal } from '@/lib/finance/dashboardUtils';
import { abreviarValor, caminhoSuave, escalaPontos, fecharArea, marcasEixo } from '@/lib/grafico';
import estilos from './EvolucaoSaldo.module.css';

const LARGURA = 640;
const ALTURA = 216;
const EIXO_Y = 52;
const MARGEM_TOPO = 14;
const MARGEM_BASE = 26;

function rotuloDia(chave) {
  const [, mm, dd] = chave.split('-');
  return `${Number(dd)} ${MESES_CURTOS[Number(mm) - 1]}`;
}

function rotuloCompleto(chave) {
  const [yyyy, mm, dd] = chave.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

export function EvolucaoSaldo({ etiqueta, dayKeys, saldoData, carregando }) {
  const idGradiente = useId();
  const [ativo, setAtivo] = useState(null);

  const grafico = useMemo(() => {
    if (saldoData.length < 2) return null;

    const largura = LARGURA - EIXO_Y;
    const pontos = escalaPontos(saldoData, {
      largura,
      altura: ALTURA,
      margemTopo: MARGEM_TOPO,
      margemBase: MARGEM_BASE,
    }).map((p) => ({ ...p, x: p.x + EIXO_Y }));

    const linha = caminhoSuave(pontos);
    const marcas = marcasEixo(saldoData, 5);
    const base = ALTURA - MARGEM_BASE;

    const passoRotulo = Math.max(1, Math.ceil(dayKeys.length / 5));
    const rotulosX = dayKeys
      .map((chave, i) => ({ chave, i }))
      .filter(({ i }) => i === 0 || i === dayKeys.length - 1 || i % passoRotulo === 0);

    return {
      pontos,
      linha,
      area: fecharArea(linha, pontos, base),
      marcas,
      base,
      rotulosX,
    };
  }, [saldoData, dayKeys]);

  return (
    <Cartao>
      <CartaoCabecalho
        titulo="Evolução do saldo"
        icone="linha"
        acao={<span className={estilos.etiqueta}>{etiqueta}</span>}
      />

      {carregando ? (
        <Esqueleto largura="100%" altura={216} raio="var(--r-md)" />
      ) : !grafico ? (
        <EstadoVazio
          icone="linha"
          titulo="Ainda não dá para desenhar a curva"
          descricao="A evolução aparece a partir de dois dias com movimentação registrada no mês."
        />
      ) : (
        <div className={estilos.area}>
          <svg
            className={estilos.svg}
            viewBox={`0 0 ${LARGURA} ${ALTURA}`}
            role="img"
            aria-label={`Evolução do saldo: de ${formatarReal(saldoData[0])} a ${formatarReal(
              saldoData[saldoData.length - 1],
            )}`}
          >
            <defs>
              <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--verde)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--verde)" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {grafico.marcas.map((marca, i) => {
              const proporcao = i / (grafico.marcas.length - 1 || 1);
              const y = grafico.base - proporcao * (grafico.base - MARGEM_TOPO);
              return (
                <g key={marca}>
                  <line className={estilos.grade} x1={EIXO_Y} y1={y} x2={LARGURA} y2={y} />
                  <text className={estilos.marcaTexto} x={0} y={y + 3}>
                    {abreviarValor(marca)}
                  </text>
                </g>
              );
            })}

            <path d={grafico.area} fill={`url(#${idGradiente})`} />
            <path className={estilos.linha} d={grafico.linha} />

            {grafico.rotulosX.map(({ chave, i }) => (
              <text
                key={chave}
                className={estilos.marcaTexto}
                x={grafico.pontos[i].x}
                y={ALTURA - 6}
                textAnchor={i === 0 ? 'start' : i === dayKeys.length - 1 ? 'end' : 'middle'}
              >
                {rotuloDia(chave)}
              </text>
            ))}

            {ativo !== null ? (
              <circle
                className={estilos.ponto}
                cx={grafico.pontos[ativo].x}
                cy={grafico.pontos[ativo].y}
                r={4}
              />
            ) : null}

            {grafico.pontos.map((ponto, i) => (
              <rect
                key={dayKeys[i]}
                className={estilos.alvo}
                x={ponto.x - 6}
                y={0}
                width={12}
                height={ALTURA}
                onMouseEnter={() => setAtivo(i)}
                onMouseLeave={() => setAtivo(null)}
              />
            ))}
          </svg>

          {ativo !== null ? (
            <div
              className={estilos.dica}
              style={{
                left: `${(grafico.pontos[ativo].x / LARGURA) * 100}%`,
                top: `${(grafico.pontos[ativo].y / ALTURA) * 100}%`,
              }}
            >
              <p className={`${estilos.dicaValor} numero`}>{formatarReal(saldoData[ativo])}</p>
              <p className={estilos.dicaData}>{rotuloCompleto(dayKeys[ativo])}</p>
            </div>
          ) : null}
        </div>
      )}
    </Cartao>
  );
}
