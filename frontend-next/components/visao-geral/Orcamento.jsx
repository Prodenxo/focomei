'use client';

import { Botao } from '@/components/ui/Botao';
import { Cartao, CartaoCabecalho } from '@/components/ui/Cartao';
import { Esqueleto, EstadoVazio } from '@/components/ui/Estados';
import estilosMov from './Movimentacoes.module.css';
import estilos from './Orcamento.module.css';

/** Mesmas faixas e mesmos rótulos da tela atual. */
const FAIXAS = [
  { chave: 'verde', rotulo: 'OK', cor: 'var(--verde)' },
  { chave: 'amarelo', rotulo: 'Atenção', cor: 'var(--alerta)' },
  { chave: 'laranja', rotulo: 'Cuidado', cor: '#f97316' },
  { chave: 'vermelho', rotulo: 'Alerta', cor: 'var(--saida)' },
];

function Abas({ aba, aoTrocar }) {
  return (
    <div className={estilosMov.abas} role="tablist" aria-label="Tipo de orçamento">
      {[
        { id: 'entrada', rotulo: 'Entrada' },
        { id: 'saida', rotulo: 'Saída' },
      ].map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={aba === item.id}
          className={`${estilosMov.aba} ${aba === item.id ? estilosMov.abaAtiva : ''}`.trim()}
          onClick={() => aoTrocar(item.id)}
        >
          {item.rotulo}
        </button>
      ))}
    </div>
  );
}

export function Orcamento({ aba, aoTrocarAba, faixas, temAlgum, carregando, hrefOrcamentos }) {
  return (
    <Cartao>
      <CartaoCabecalho
        titulo="Orçamento por categoria"
        icone="maleta"
        acao={<Abas aba={aba} aoTrocar={aoTrocarAba} />}
      />

      {carregando ? (
        <div className={estilos.grade}>
          {FAIXAS.map((faixa) => (
            <Esqueleto key={faixa.chave} largura="100%" altura={116} raio="var(--r-md)" />
          ))}
        </div>
      ) : !temAlgum ? (
        <EstadoVazio
          icone="maleta"
          titulo={`Nenhum orçamento de ${aba === 'entrada' ? 'entrada' : 'saída'} neste mês`}
          descricao="Defina valores em Orçamentos para ver OK, Atenção e Alerta aqui."
          acao={
            <Botao variante="verdeSuave" pequeno como="a" href={hrefOrcamentos}>
              Ir para Orçamentos
            </Botao>
          }
        />
      ) : (
        <div className={estilos.grade}>
          {FAIXAS.map((faixa) => {
            const itens = faixas[faixa.chave] || [];
            return (
              <div key={faixa.chave} className={estilos.faixa}>
                <div className={estilos.faixaTopo}>
                  <span className={estilos.faixaTitulo} style={{ color: faixa.cor }}>
                    <span className={estilos.ponto} style={{ background: faixa.cor }} />
                    {faixa.rotulo}
                  </span>
                  <span className={estilos.faixaContagem}>
                    {itens.length} {itens.length === 1 ? 'categoria' : 'categorias'}
                  </span>
                </div>

                {itens.length === 0 ? (
                  <p className={estilos.vazio}>Nenhuma categoria nesta faixa</p>
                ) : (
                  itens.slice(0, 4).map((item) => {
                    const pct = Math.min(100, Math.max(0, item.percentual));
                    return (
                      <div key={`${item.categorias_id}-${faixa.chave}`} className={estilos.item}>
                        <div className={estilos.itemLinha}>
                          <span className={estilos.itemNome}>{item.nome}</span>
                          <span className={`${estilos.itemPct} numero`}>{pct.toFixed(0)}%</span>
                        </div>
                        <span className={estilos.trilha}>
                          <span
                            className={estilos.preenchida}
                            style={{ width: `${pct}%`, background: faixa.cor }}
                          />
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}
    </Cartao>
  );
}
