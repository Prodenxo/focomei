import { Icone } from '@/components/ui/Icone';
import { Esqueleto } from '@/components/ui/Estados';
import { formatarReal } from '@/lib/finance/dashboardUtils';
import estilos from './Indicadores.module.css';

/** Entradas e Saídas do mês — só lançamentos realizados, como na tela atual. */
export function CartaoFluxo({ tipo, valor, carregando }) {
  const entrada = tipo === 'entrada';

  return (
    <div className={estilos.fluxo}>
      <span className={`${estilos.selo} ${entrada ? estilos.seloEntrada : estilos.seloSaida}`}>
        <Icone nome={entrada ? 'setaCima' : 'setaBaixo'} tamanho={20} />
      </span>
      <div className={estilos.fluxoTexto}>
        <p className={estilos.fluxoRotulo}>{entrada ? 'Entradas' : 'Saídas'}</p>
        {carregando ? (
          <Esqueleto largura={130} altura={24} style={{ margin: '4px 0' }} />
        ) : (
          <p className={`${estilos.fluxoValor} numero`}>{formatarReal(valor)}</p>
        )}
        <p className={estilos.fluxoDica}>Neste mês</p>
      </div>
    </div>
  );
}

const ICONE_POR_INSIGHT = {
  analytics: 'carteira',
  wallet: 'relogio',
  time: 'calendario',
  alert: 'documento',
  receipt: 'lista',
  swap: 'grafico',
};

const TOM = {
  positive: estilos.positivo,
  negative: estilos.negativo,
  neutral: estilos.neutro,
  accent: estilos.destaque,
};

export function ResumoIndicadores({ insights, carregando }) {
  if (carregando) {
    return (
      <div className={estilos.resumo}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={estilos.indicador}>
            <Esqueleto largura={34} altura={34} raio="var(--r-md)" />
            <div className={estilos.indicadorTexto}>
              <Esqueleto largura={72} altura={9} />
              <Esqueleto largura={58} altura={14} style={{ marginTop: 6 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={estilos.resumo}>
      {insights.map((insight) => (
        <div key={insight.id} className={estilos.indicador} title={insight.hint}>
          <span className={estilos.indicadorSelo}>
            <Icone nome={ICONE_POR_INSIGHT[insight.icon] || 'lista'} tamanho={16} />
          </span>
          <div className={estilos.indicadorTexto}>
            <p className={estilos.indicadorRotulo}>{insight.label}</p>
            <p className={`${estilos.indicadorValor} ${TOM[insight.tone]} numero`}>
              {insight.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
