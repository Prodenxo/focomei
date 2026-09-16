'use client';

import { useMemo, useState } from 'react';
import { Cartao } from '@/components/ui/Cartao';
import { Esqueleto, EstadoErro, EstadoVazio } from '@/components/ui/Estados';
import { SeletorPeriodo } from '@/components/ui/SeletorPeriodo';
import { bpoMonthHeaderLabel, formatBpoCurrency, formatBpoMetricValue } from '@/lib/finance/bpoMatrix';
import estilos from './VisaoBpo.module.css';

const COLUNAS = [
  { chave: 'orcado', rotulo: 'Orçado' },
  { chave: 'realizado', rotulo: 'Realizado' },
  { chave: 'variacao', rotulo: 'Variação' },
];

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function Celula({ coluna, metricas }) {
  const texto = formatBpoMetricValue(coluna, metricas);
  const classe =
    coluna === 'variacao' && metricas.variacao !== null
      ? metricas.variacao > 0
        ? estilos.negativo
        : metricas.variacao < 0
          ? estilos.positivo
          : ''
      : '';
  return <td className={`${classe} numero`.trim()}>{texto}</td>;
}

function LinhaCategoria({ linha, colunas }) {
  return (
    <tr>
      <td className={estilos.categoriaCol} title={linha.nome}>
        {linha.nome}
      </td>
      {linha.byMonth.map((metricas, indice) =>
        colunas.map((coluna) => (
          <Celula key={`${indice}-${coluna}`} coluna={coluna} metricas={metricas} />
        )),
      )}
      {colunas.map((coluna) => (
        <Celula key={`anual-${coluna}`} coluna={coluna} metricas={linha.annual} />
      ))}
    </tr>
  );
}

function Matriz({ ano, matriz, busca }) {
  const [colunas, setColunas] = useState(['orcado', 'realizado', 'variacao']);

  const filtrar = (linhas) => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return linhas;
    return linhas.filter((linha) => linha.nome.toLowerCase().includes(termo));
  };

  const receitas = filtrar(matriz.receitas);
  const despesas = filtrar(matriz.despesas);

  const alternarColuna = (chave) => {
    setColunas((atuais) => {
      if (atuais.includes(chave)) {
        return atuais.length === 1 ? atuais : atuais.filter((c) => c !== chave);
      }
      return COLUNAS.map((c) => c.chave).filter((c) => atuais.includes(c) || c === chave);
    });
  };

  if (!receitas.length && !despesas.length) {
    return (
      <EstadoVazio
        icone="maleta"
        titulo={`Nada orçado ou realizado em ${ano}`}
        descricao="A matriz aparece quando existem orçamentos definidos ou lançamentos no ano escolhido."
      />
    );
  }

  const totalColunas = 1 + colunas.length * 13;

  return (
    <>
      <div className={estilos.colunas} role="group" aria-label="Colunas visíveis">
        {COLUNAS.map((coluna) => (
          <button
            key={coluna.chave}
            type="button"
            className={`${estilos.coluna} ${colunas.includes(coluna.chave) ? estilos.colunaAtiva : ''}`.trim()}
            onClick={() => alternarColuna(coluna.chave)}
            aria-pressed={colunas.includes(coluna.chave)}
          >
            {coluna.rotulo}
          </button>
        ))}
      </div>

      <div className={estilos.rolagem} style={{ marginTop: 'var(--e3)' }}>
        <table className={estilos.tabela}>
          <thead>
            <tr>
              <th className={estilos.categoriaCol}>Categoria</th>
              {MESES_CURTOS.map((_, indice) => (
                <th key={indice} colSpan={colunas.length} className={estilos.mesGrupo}>
                  {bpoMonthHeaderLabel(indice, ano)}
                </th>
              ))}
              <th colSpan={colunas.length} className={estilos.mesGrupo}>
                Anual
              </th>
            </tr>
            <tr>
              <th className={estilos.categoriaCol} />
              {Array.from({ length: 13 }, (_, bloco) =>
                colunas.map((chave) => (
                  <th key={`${bloco}-${chave}`}>
                    {COLUNAS.find((c) => c.chave === chave).rotulo}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            <tr className={estilos.secao}>
              <td colSpan={totalColunas}>(+) Receitas</td>
            </tr>
            {receitas.map((linha) => (
              <LinhaCategoria key={linha.categoriasId} linha={linha} colunas={colunas} />
            ))}

            <tr className={estilos.secao}>
              <td colSpan={totalColunas}>(−) Despesas</td>
            </tr>
            {despesas.map((linha) => (
              <LinhaCategoria key={linha.categoriasId} linha={linha} colunas={colunas} />
            ))}

            <tr className={estilos.totalLinha}>
              <td className={estilos.categoriaCol}>(=) Resultado</td>
              {matriz.resultado.map((metricas, indice) =>
                colunas.map((coluna) => (
                  <Celula key={`res-${indice}-${coluna}`} coluna={coluna} metricas={metricas} />
                )),
              )}
              {colunas.map((coluna) => (
                <Celula
                  key={`res-anual-${coluna}`}
                  coluna={coluna}
                  metricas={{
                    orcado: matriz.resultado.reduce(
                      (soma, m) => (m.orcado === null ? soma : (soma ?? 0) + m.orcado),
                      null,
                    ),
                    previsto: matriz.resultado.reduce((soma, m) => soma + m.previsto, 0),
                    realizado: matriz.resultado.reduce((soma, m) => soma + m.realizado, 0),
                    variacao: matriz.resultado.reduce(
                      (soma, m) => (m.variacao === null ? soma : (soma ?? 0) + m.variacao),
                      null,
                    ),
                  }}
                />
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function GraficoCategoria({ categoria }) {
  const maior = useMemo(
    () => Math.max(...categoria.budgeted, ...categoria.realized, 1),
    [categoria],
  );

  return (
    <Cartao className={estilos.cartaoGrafico} compacto>
      <div className={estilos.graficoTopo}>
        <div>
          <p className={estilos.graficoNome}>{categoria.name}</p>
          <p className={estilos.graficoResumo}>
            Orçado {formatBpoCurrency(categoria.totalBudgeted)} · Realizado{' '}
            {formatBpoCurrency(categoria.totalRealized)}
          </p>
        </div>
        <span className={estilos.legenda}>
          <span className={estilos.legendaItem}>
            <span className={`${estilos.legendaPonto} ${estilos.barraOrcado}`} />
            Orçado
          </span>
          <span className={estilos.legendaItem}>
            <span className={`${estilos.legendaPonto} ${estilos.barraRealizado}`} />
            Realizado
          </span>
        </span>
      </div>

      <div className={estilos.barras}>
        {MESES_CURTOS.map((mes, indice) => (
          <div key={mes} className={estilos.barraColuna}>
            <div className={estilos.barraPar}>
              <span
                className={`${estilos.barra} ${estilos.barraOrcado}`}
                style={{ height: `${(categoria.budgeted[indice] / maior) * 100}%` }}
                title={`${mes}: orçado ${formatBpoCurrency(categoria.budgeted[indice])}`}
              />
              <span
                className={`${estilos.barra} ${estilos.barraRealizado}`}
                style={{ height: `${(categoria.realized[indice] / maior) * 100}%` }}
                title={`${mes}: realizado ${formatBpoCurrency(categoria.realized[indice])}`}
              />
            </div>
            <span className={estilos.barraMes}>{mes}</span>
          </div>
        ))}
      </div>
    </Cartao>
  );
}

export function VisaoBpo({
  ano,
  anoMinimo,
  anoMaximo,
  aoVoltarAno,
  aoAvancarAno,
  modo,
  aoTrocarModo,
  matriz,
  carregandoMatriz,
  erroMatriz,
  aoRecarregarMatriz,
  series,
  carregandoSeries,
  legenda,
}) {
  const [busca, setBusca] = useState('');
  const entradas = series.filter((item) => item.type === 'entrada');
  const saidas = series.filter((item) => item.type !== 'entrada');

  return (
    <Cartao>
      <div className={estilos.barra}>
        <div className={estilos.grupoEsquerdo}>
          <div className={estilos.modos} role="tablist" aria-label="Formato da visão BPO">
            {[
              { id: 'matriz', rotulo: 'Matriz' },
              { id: 'graficos', rotulo: 'Gráficos' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={modo === item.id}
                className={`${estilos.modo} ${modo === item.id ? estilos.modoAtivo : ''}`.trim()}
                onClick={() => aoTrocarModo(item.id)}
              >
                {item.rotulo}
              </button>
            ))}
          </div>

          {modo === 'matriz' ? (
            <input
              className={estilos.busca}
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar categoria"
              aria-label="Buscar categoria na matriz"
            />
          ) : null}
        </div>

        <SeletorPeriodo
          rotulo={String(ano)}
          icone={null}
          aoVoltar={aoVoltarAno}
          aoAvancar={aoAvancarAno}
          desabilitarVoltar={ano <= anoMinimo}
          desabilitarAvancar={ano >= anoMaximo}
          descricaoVoltar="Ano anterior"
          descricaoAvancar="Próximo ano"
        />
      </div>

      <p className={estilos.graficoResumo} style={{ marginBottom: 'var(--e3)' }}>
        {legenda}
      </p>

      {modo === 'matriz' ? (
        carregandoMatriz ? (
          <Esqueleto largura="100%" altura={260} raio="var(--r-md)" />
        ) : erroMatriz ? (
          <EstadoErro
            titulo="Não foi possível carregar a matriz"
            descricao={erroMatriz}
            aoTentarNovamente={aoRecarregarMatriz}
          />
        ) : (
          <Matriz ano={ano} matriz={matriz} busca={busca} />
        )
      ) : carregandoSeries ? (
        <Esqueleto largura="100%" altura={220} raio="var(--r-md)" />
      ) : series.length === 0 ? (
        <EstadoVazio
          icone="grafico"
          titulo={`Nenhuma categoria com orçamento em ${ano}`}
          descricao="Defina orçamentos por categoria para comparar o planejado com o realizado."
        />
      ) : (
        <>
          <div className={estilos.tituloSecao}>
            <span className={estilos.tituloSecaoTexto}>Entradas</span>
            <span className={estilos.tituloSecaoContagem}>
              {entradas.length} {entradas.length === 1 ? 'categoria' : 'categorias'}
            </span>
          </div>
          {entradas.length === 0 ? (
            <p className={estilos.graficoResumo}>Nenhuma categoria de entrada com orçamento.</p>
          ) : (
            entradas.map((categoria) => (
              <GraficoCategoria key={categoria.id} categoria={categoria} />
            ))
          )}

          <div className={estilos.tituloSecao}>
            <span className={estilos.tituloSecaoTexto}>Saídas</span>
            <span className={estilos.tituloSecaoContagem}>
              {saidas.length} {saidas.length === 1 ? 'categoria' : 'categorias'}
            </span>
          </div>
          {saidas.length === 0 ? (
            <p className={estilos.graficoResumo}>Nenhuma categoria de saída com orçamento.</p>
          ) : (
            saidas.map((categoria) => <GraficoCategoria key={categoria.id} categoria={categoria} />)
          )}
        </>
      )}
    </Cartao>
  );
}
