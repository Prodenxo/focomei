import { Botao } from './Botao';
import { Icone } from './Icone';
import estilos from './Estados.module.css';

export function Esqueleto({ largura = '100%', altura = 14, raio, className = '', style }) {
  return (
    <span
      className={`${estilos.esqueleto} ${className}`.trim()}
      style={{ width: largura, height: altura, borderRadius: raio, ...style }}
      aria-hidden="true"
    />
  );
}

export function EstadoVazio({ icone = 'recibo', titulo, descricao, acao }) {
  return (
    <div className={estilos.estado}>
      <span className={estilos.selo}>
        <Icone nome={icone} tamanho={20} />
      </span>
      <p className={estilos.titulo}>{titulo}</p>
      {descricao ? <p className={estilos.descricao}>{descricao}</p> : null}
      {acao ? <div className={estilos.acao}>{acao}</div> : null}
    </div>
  );
}

export function EstadoErro({ titulo = 'Não foi possível carregar', descricao, aoTentarNovamente }) {
  return (
    <div className={estilos.estado} role="alert">
      <span className={`${estilos.selo} ${estilos.seloErro}`}>
        <Icone nome="alerta" tamanho={20} />
      </span>
      <p className={estilos.titulo}>{titulo}</p>
      {descricao ? <p className={estilos.descricao}>{descricao}</p> : null}
      {aoTentarNovamente ? (
        <div className={estilos.acao}>
          <Botao variante="secundario" pequeno onClick={aoTentarNovamente}>
            <Icone nome="atualizar" tamanho={14} />
            Tentar de novo
          </Botao>
        </div>
      ) : null}
    </div>
  );
}
