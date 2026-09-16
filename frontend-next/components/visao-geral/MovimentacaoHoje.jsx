import { Botao } from '@/components/ui/Botao';
import { Cartao, CartaoAcao, CartaoCabecalho } from '@/components/ui/Cartao';
import { Esqueleto, EstadoVazio } from '@/components/ui/Estados';
import { Icone } from '@/components/ui/Icone';
import { formatarReal } from '@/lib/finance/dashboardUtils';
import estilos from './Movimentacoes.module.css';

export function MovimentacaoHoje({ fluxo, carregando, hrefAgenda, aoNovaTransacao }) {
  const vazio = !carregando && fluxo.income === 0 && fluxo.expense === 0;

  return (
    <Cartao>
      <CartaoCabecalho
        titulo="Movimentação de hoje"
        icone="agenda"
        acao={<CartaoAcao href={hrefAgenda} rotulo="Abrir agenda">Ver agenda</CartaoAcao>}
      />

      {carregando ? (
        <div className={estilos.hoje}>
          <Esqueleto largura="100%" altura={72} raio="var(--r-md)" />
          <Esqueleto largura="100%" altura={72} raio="var(--r-md)" />
        </div>
      ) : vazio ? (
        <EstadoVazio
          icone="documento"
          titulo="Nenhuma movimentação hoje"
          descricao="Que tal registrar uma nova transação?"
          acao={
            <Botao variante="verdeSuave" pequeno onClick={aoNovaTransacao}>
              <Icone nome="mais" tamanho={14} />
              Nova transação
            </Botao>
          }
        />
      ) : (
        <div className={estilos.hoje}>
          <div className={estilos.hojeBloco}>
            <p className={estilos.hojeRotulo}>
              <Icone nome="setaCima" tamanho={13} />
              Entrou hoje
            </p>
            <p className={`${estilos.hojeValor} ${estilos.entrada} numero`}>
              {formatarReal(fluxo.income)}
            </p>
          </div>
          <div className={estilos.hojeBloco}>
            <p className={estilos.hojeRotulo}>
              <Icone nome="setaBaixo" tamanho={13} />
              Saiu hoje
            </p>
            <p className={`${estilos.hojeValor} ${estilos.saida} numero`}>
              {formatarReal(fluxo.expense)}
            </p>
          </div>
        </div>
      )}
    </Cartao>
  );
}
