'use client';

import { useTema } from '@/components/tema/TemaProvider';
import { BotaoIcone } from './Botao';
import { Icone } from './Icone';
import estilos from './NavTopo.module.css';

function iniciais(nome) {
  const limpo = String(nome || '').trim();
  if (!limpo) return 'ME';
  const partes = limpo.split(/\s+/);
  const letras = partes.length > 1 ? `${partes[0][0]}${partes[1][0]}` : limpo.slice(0, 2);
  return letras.toUpperCase();
}

export function NavTopo({ itens, idAtivo, nomeUsuario, hrefConta, aoSair }) {
  const { escuro, alternar } = useTema();

  return (
    <header className={estilos.barra}>
      <div className={estilos.interno}>
        <span className={estilos.marca}>
          Foco
          <span className={estilos.marcaSelo} aria-hidden="true" />
          MEI
        </span>

        <nav className={estilos.links} aria-label="Navegação principal">
          {itens.map((item) => {
            const ativo = item.id === idAtivo;
            return (
              <a
                key={item.id}
                href={item.url}
                className={`${estilos.link} ${ativo ? estilos.linkAtivo : ''}`.trim()}
                aria-current={ativo ? 'page' : undefined}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className={estilos.acoes}>
          <BotaoIcone
            rotulo={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
            onClick={alternar}
          >
            <Icone nome={escuro ? 'sol' : 'lua'} tamanho={17} />
          </BotaoIcone>

          <a className={estilos.conta} href={hrefConta} aria-label="Minha conta e configurações">
            <span className={estilos.avatar} aria-hidden="true">
              {iniciais(nomeUsuario)}
            </span>
            <span className={estilos.rotuloEscondido}>Minha conta</span>
          </a>

          <button type="button" className={estilos.sair} onClick={aoSair}>
            <Icone nome="sair" tamanho={16} />
            <span className={estilos.rotuloEscondido}>Sair</span>
          </button>
        </div>
      </div>
    </header>
  );
}
