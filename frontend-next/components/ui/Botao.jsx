import estilos from './Botao.module.css';

const VARIANTES = {
  primario: estilos.primario,
  secundario: estilos.secundario,
  fantasma: estilos.fantasma,
  verdeSuave: estilos.verdeSuave,
};

export function Botao({
  variante = 'secundario',
  pequeno = false,
  blocoTotal = false,
  como: Como = 'button',
  className = '',
  children,
  ...resto
}) {
  const classes = [
    estilos.base,
    VARIANTES[variante] || VARIANTES.secundario,
    pequeno ? estilos.pequeno : '',
    blocoTotal ? estilos.blocoTotal : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Como className={classes} {...resto}>
      {children}
    </Como>
  );
}

/** Botão só de ícone — `rotulo` vira o nome acessível. */
export function BotaoIcone({ rotulo, contornado = false, className = '', children, ...resto }) {
  const classes = [
    estilos.iconeSozinho,
    contornado ? estilos.iconeContornado : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" aria-label={rotulo} title={rotulo} className={classes} {...resto}>
      {children}
    </button>
  );
}
