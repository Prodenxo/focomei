import { Icone } from './Icone';
import estilos from './Cartao.module.css';

export function Cartao({ compacto = false, semPadding = false, className = '', children, ...resto }) {
  const classes = [
    estilos.cartao,
    compacto ? estilos.compacto : '',
    semPadding ? estilos.semPadding : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes} {...resto}>
      {children}
    </section>
  );
}

export function CartaoCabecalho({ titulo, icone, acao }) {
  return (
    <header className={estilos.cabecalho}>
      <div className={estilos.tituloGrupo}>
        {icone ? (
          <span className={estilos.tituloIcone}>
            <Icone nome={icone} tamanho={18} />
          </span>
        ) : null}
        <h2 className={estilos.titulo}>{titulo}</h2>
      </div>
      {acao}
    </header>
  );
}

export function CartaoAcao({ href, onClick, children, rotulo }) {
  const conteudo = (
    <>
      {children}
      <Icone nome="setaDireita" tamanho={13} />
    </>
  );

  if (href) {
    return (
      <a className={estilos.acao} href={href} aria-label={rotulo}>
        {conteudo}
      </a>
    );
  }

  return (
    <button type="button" className={estilos.acao} onClick={onClick} aria-label={rotulo}>
      {conteudo}
    </button>
  );
}
