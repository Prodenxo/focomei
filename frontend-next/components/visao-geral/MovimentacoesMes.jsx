'use client';

import { useMemo } from 'react';
import { Cartao, CartaoCabecalho } from '@/components/ui/Cartao';
import { Esqueleto, EstadoVazio } from '@/components/ui/Estados';
import { formatarReal } from '@/lib/finance/dashboardUtils';
import estilos from './Movimentacoes.module.css';

function Abas({ aba, aoTrocar }) {
  return (
    <div className={estilos.abas} role="tablist" aria-label="Situação das saídas">
      {[
        { id: 'pagos', rotulo: 'Pagos' },
        { id: 'a_pagar', rotulo: 'A pagar' },
      ].map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={aba === item.id}
          className={`${estilos.aba} ${aba === item.id ? estilos.abaAtiva : ''}`.trim()}
          onClick={() => aoTrocar(item.id)}
        >
          {item.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Saídas do mês por categoria, separadas entre pagas e a pagar. */
export function MovimentacoesMes({ aba, aoTrocarAba, porCategoria, total, categoriasMap, carregando }) {
  const linhas = useMemo(() => {
    const maior = Math.max(...Object.values(porCategoria), 0);
    return Object.entries(porCategoria)
      .map(([chave, valor]) => ({
        chave,
        nome: categoriasMap[chave] || (chave === 'sem-categoria' ? 'Sem categoria' : chave),
        valor,
        proporcao: maior > 0 ? (valor / maior) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [porCategoria, categoriasMap]);

  return (
    <Cartao>
      <CartaoCabecalho
        titulo="Movimentações do mês"
        icone="grafico"
        acao={<Abas aba={aba} aoTrocar={aoTrocarAba} />}
      />

      {carregando ? (
        <>
          <Esqueleto largura="45%" altura={22} />
          <Esqueleto largura="100%" altura={92} style={{ marginTop: 12 }} raio="var(--r-md)" />
        </>
      ) : linhas.length === 0 ? (
        <EstadoVazio
          icone="grafico"
          titulo={aba === 'pagos' ? 'Nenhuma saída paga no mês' : 'Nenhuma conta em aberto'}
          descricao={
            aba === 'pagos'
              ? 'Quando você marcar uma saída como paga, ela aparece aqui separada por categoria.'
              : 'Nada pendente para este mês — as contas a pagar aparecem aqui.'
          }
        />
      ) : (
        <>
          <div className={estilos.totalLinha}>
            <span className={estilos.totalRotulo}>
              {aba === 'pagos' ? 'Total já pago' : 'Total a pagar'}
            </span>
            <span className={`${estilos.totalValor} numero`}>{formatarReal(total)}</span>
          </div>
          <ul className={estilos.lista}>
            {linhas.map((linha) => (
              <li key={linha.chave} className={estilos.categoria}>
                <span className={estilos.categoriaNome}>{linha.nome}</span>
                <span
                  className={estilos.categoriaBarra}
                  role="img"
                  aria-label={`${Math.round(linha.proporcao)}% da maior categoria`}
                >
                  <span
                    className={estilos.categoriaPreenchida}
                    style={{ width: `${linha.proporcao}%` }}
                  />
                </span>
                <span className={`${estilos.categoriaValor} numero`}>
                  {formatarReal(linha.valor)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Cartao>
  );
}
