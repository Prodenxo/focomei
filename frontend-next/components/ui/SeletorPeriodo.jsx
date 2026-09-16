import { BotaoIcone } from './Botao';
import { Icone } from './Icone';
import estilos from './SeletorPeriodo.module.css';

export function SeletorPeriodo({
  rotulo,
  aoVoltar,
  aoAvancar,
  desabilitarVoltar = false,
  desabilitarAvancar = false,
  icone = 'calendario',
  descricaoVoltar = 'Mês anterior',
  descricaoAvancar = 'Próximo mês',
}) {
  return (
    <div className={estilos.grupo}>
      <BotaoIcone
        contornado
        rotulo={descricaoVoltar}
        onClick={aoVoltar}
        disabled={desabilitarVoltar}
      >
        <Icone nome="esquerda" tamanho={16} />
      </BotaoIcone>

      <div className={estilos.mes} aria-live="polite">
        {icone ? (
          <span className={estilos.icone}>
            <Icone nome={icone} tamanho={15} />
          </span>
        ) : null}
        {rotulo}
      </div>

      <BotaoIcone
        contornado
        rotulo={descricaoAvancar}
        onClick={aoAvancar}
        disabled={desabilitarAvancar}
      >
        <Icone nome="direita" tamanho={16} />
      </BotaoIcone>
    </div>
  );
}
