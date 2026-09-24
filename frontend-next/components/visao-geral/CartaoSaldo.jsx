'use client';

import { Icone } from '@/components/ui/Icone';
import { formatarReal } from '@/lib/finance/dashboardUtils';
import estilos from './CartaoSaldo.module.css';

/**
 * Hero financeiro no mesmo padrão visual do Foco MEI: saldo primeiro e fluxo do
 * período separado por semântica, sem alterar os cálculos recebidos.
 */
export function CartaoSaldo({
  rotulo,
  dica,
  valor,
  totalIncome,
  totalExpenses,
  carregando,
  visivel,
  aoAlternarVisibilidade,
}) {
  return (
    <div className={estilos.cartao}>
      <span className={estilos.circuloMaior} aria-hidden="true" />
      <span className={estilos.circuloMenor} aria-hidden="true" />

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

      <p className={estilos.rodape}>{carregando ? 'Carregando…' : dica}</p>

      <div className={estilos.fluxos}>
        <div className={estilos.fluxo}>
          <span className={`${estilos.fluxoIcone} ${estilos.entrada}`}>
            <Icone nome="setaCima" tamanho={17} />
          </span>
          <div>
            <p className={estilos.fluxoRotulo}>Entradas</p>
            <p className={`${estilos.fluxoValor} numero`}>
              {carregando ? '—' : formatarReal(totalIncome)}
            </p>
          </div>
        </div>
        <div className={`${estilos.fluxo} ${estilos.fluxoSaida}`}>
          <span className={`${estilos.fluxoIcone} ${estilos.saida}`}>
            <Icone nome="setaBaixo" tamanho={17} />
          </span>
          <div>
            <p className={estilos.fluxoRotulo}>Saídas</p>
            <p className={`${estilos.fluxoValor} numero`}>
              {carregando ? '—' : formatarReal(totalExpenses)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
