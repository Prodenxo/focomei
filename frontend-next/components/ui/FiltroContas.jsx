import { Icone } from './Icone';
import estilos from './FiltroContas.module.css';

function Chip({ ativo, aoClicar, children, dica }) {
  return (
    <button
      type="button"
      className={`${estilos.chip} ${ativo ? estilos.ativo : ''}`.trim()}
      onClick={aoClicar}
      aria-pressed={ativo}
      title={dica}
    >
      {children}
    </button>
  );
}

/**
 * "Todas", cada conta cadastrada e "Meu financeiro" (lançamentos sem conta bancária),
 * com atalho para a tela de contas do app atual.
 */
export function FiltroContas({ contas, filtro, aoFiltrar, hrefConfiguracoes }) {
  if (!contas.length) return null;

  return (
    <div className={estilos.trilha} role="group" aria-label="Filtrar por conta">
      <Chip ativo={filtro === 'all'} aoClicar={() => aoFiltrar('all')}>
        <span className={estilos.icone}>
          <Icone nome="grade" tamanho={15} />
        </span>
        <span className={estilos.rotulo}>Todas</span>
      </Chip>

      {contas.map((conta) => (
        <Chip
          key={conta.id}
          ativo={filtro === conta.id}
          aoClicar={() => aoFiltrar(conta.id)}
          dica={conta.nome}
        >
          <span className={estilos.ponto} style={{ background: conta.cor || 'var(--verde)' }} />
          <span className={estilos.rotulo}>{conta.nome}</span>
        </Chip>
      ))}

      <Chip
        ativo={filtro === 'unassigned'}
        aoClicar={() => aoFiltrar('unassigned')}
        dica="Lançamentos sem conta bancária vinculada"
      >
        <span className={estilos.icone}>
          <Icone nome="grafico" tamanho={15} />
        </span>
        <span className={estilos.rotulo}>Meu financeiro</span>
      </Chip>

      <a
        className={`${estilos.chip} ${estilos.config}`}
        href={hrefConfiguracoes}
        aria-label="Configurar contas"
      >
        <span className={estilos.icone}>
          <Icone nome="engrenagem" tamanho={15} />
        </span>
        <span className={estilos.rotulo}>Configurações</span>
      </a>
    </div>
  );
}
