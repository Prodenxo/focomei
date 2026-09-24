import { Botao } from '@/components/ui/Botao';
import { Cartao, CartaoAcao, CartaoCabecalho } from '@/components/ui/Cartao';
import { Esqueleto, EstadoVazio } from '@/components/ui/Estados';
import { Icone } from '@/components/ui/Icone';
import estilos from './Movimentacoes.module.css';

const ROTULO_STATUS = {
  recebido: 'Recebimento',
  pago: 'Pagamento',
  a_receber: 'A receber',
  a_pagar: 'A pagar',
};

function legenda(item, contaNameById) {
  const conta = item.contaId ? contaNameById[item.contaId] : null;
  const situacao = ROTULO_STATUS[item.status] || item.status || '';
  return [conta || 'Meu financeiro', situacao].filter(Boolean).join(' · ');
}

function dataCurta(data) {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return '';
  return data.toLocaleDateString('pt-BR');
}

export function UltimasMovimentacoes({
  itens,
  contaNameById,
  carregando,
  hrefTodas,
  aoNovaTransacao,
}) {
  return (
    <Cartao>
      <CartaoCabecalho
        titulo="Últimas movimentações"
        icone="relogio"
        acao={<CartaoAcao href={hrefTodas} rotulo="Ver todas as movimentações">Ver todas</CartaoAcao>}
      />

      {carregando ? (
        <div className={estilos.lista}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className={estilos.item}>
              <Esqueleto largura={36} altura={36} raio="var(--r-md)" />
              <div className={estilos.texto}>
                <Esqueleto largura="52%" altura={12} />
                <Esqueleto largura="36%" altura={10} style={{ marginTop: 6 }} />
              </div>
              <Esqueleto largura={72} altura={12} />
            </div>
          ))}
        </div>
      ) : itens.length === 0 ? (
        <EstadoVazio
          icone="recibo"
          titulo="Nenhuma movimentação neste mês"
          descricao="Registre uma entrada ou saída para começar a acompanhar o mês."
          acao={
            <Botao variante="verdeSuave" pequeno onClick={aoNovaTransacao}>
              <Icone nome="mais" tamanho={14} />
              Nova transação
            </Botao>
          }
        />
      ) : (
        <ul className={estilos.lista}>
          {itens.map((item) => {
            const entrada = item.tipo === 'entrada';
            return (
              <li key={item.id} className={estilos.item}>
                <span
                  className={`${estilos.selo} ${entrada ? estilos.seloEntrada : estilos.seloSaida}`}
                >
                  <Icone nome={entrada ? 'carteira' : 'recibo'} tamanho={17} />
                </span>
                <div className={estilos.texto}>
                  <p className={estilos.titulo}>{item.title}</p>
                  <p className={estilos.legenda}>{legenda(item, contaNameById)}</p>
                </div>
                <div className={estilos.numeros}>
                  <p
                    className={`${estilos.valor} ${entrada ? estilos.entrada : estilos.saida} numero`}
                  >
                    {entrada ? '+ ' : '- '}
                    {item.amount}
                  </p>
                  <p className={estilos.data}>{dataCurta(item.dataCompleta)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Cartao>
  );
}
