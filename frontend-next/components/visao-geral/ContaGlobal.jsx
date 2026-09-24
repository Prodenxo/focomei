import { Botao } from '@/components/ui/Botao';
import { Cartao, CartaoCabecalho } from '@/components/ui/Cartao';
import { Icone } from '@/components/ui/Icone';
import estilos from './ContaGlobal.module.css';

/** Atalho, não saldo: a conta global fica fora do total em reais. */
export function ContaGlobal({ href }) {
  return (
    <Cartao>
      <CartaoCabecalho titulo="Conta global" icone="globo" />
      <div className={estilos.conteudo}>
        <div>
          <p className={estilos.marcador}>Internacional</p>
          <p className={estilos.texto}>
            Acesse sua conta global para ver saldos em outras moedas. Esses valores ficam fora do
            saldo em reais mostrado acima.
          </p>
        </div>
        <Botao variante="verdeSuave" como="a" href={href}>
          Acessar conta global
          <Icone nome="setaDireita" tamanho={15} />
        </Botao>
      </div>
    </Cartao>
  );
}

/**
 * Aprovação de acesso vive numa Edge Function do Supabase, fora do contrato da API
 * que esta tela consome. Aqui só o atalho — a ação continua na tela antiga.
 */
export function SolicitacoesAcesso({ href }) {
  return (
    <Cartao>
      <CartaoCabecalho titulo="Solicitações de acesso" icone="pessoas" />
      <div className={estilos.conteudo}>
        <p className={estilos.aviso}>
          <span className={estilos.avisoIcone}>
            <Icone nome="alerta" tamanho={16} />
          </span>
          Aprovar ou negar acessos continua na tela de solicitações.
        </p>
        <Botao variante="secundario" como="a" href={href}>
          Abrir solicitações
          <Icone nome="setaDireita" tamanho={15} />
        </Botao>
      </div>
    </Cartao>
  );
}
