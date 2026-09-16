import { Botao } from '@/components/ui/Botao';
import { Icone } from '@/components/ui/Icone';
import { SeletorPeriodo } from '@/components/ui/SeletorPeriodo';
import { MESES } from '@/lib/finance/dashboardUtils';
import estilos from './Cabecalho.module.css';

export function Cabecalho({
  nome,
  mes,
  aoVoltarMes,
  aoAvancarMes,
  mostrarBpo,
  bpoAtivo,
  aoAlternarBpo,
  aoNovaTransacao,
}) {
  return (
    <header className={estilos.cabecalho}>
      <div>
        <h1 className={estilos.saudacao}>Visão geral</h1>
        <p className={estilos.legenda}>Olá, {nome}</p>
      </div>

      <div className={estilos.controles}>
        <SeletorPeriodo
          rotulo={`${MESES[mes.month - 1]} ${mes.year}`}
          aoVoltar={aoVoltarMes}
          aoAvancar={aoAvancarMes}
        />

        {mostrarBpo ? (
          <Botao
            variante="secundario"
            onClick={aoAlternarBpo}
            aria-pressed={bpoAtivo}
            className={bpoAtivo ? estilos.bpoAtivo : ''}
          >
            <Icone nome="pessoas" tamanho={16} />
            BPO
          </Botao>
        ) : null}

        <Botao variante="primario" onClick={aoNovaTransacao}>
          <Icone nome="mais" tamanho={16} />
          Nova transação
        </Botao>
      </div>
    </header>
  );
}
