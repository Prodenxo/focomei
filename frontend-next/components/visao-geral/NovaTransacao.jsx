'use client';

import { useEffect, useRef, useState } from 'react';
import { Botao, BotaoIcone } from '@/components/ui/Botao';
import { Icone } from '@/components/ui/Icone';
import { criarTransacao } from '@/services/visaoGeral';
import estilos from './NovaTransacao.module.css';

function hojeIso() {
  const agora = new Date();
  const mm = String(agora.getMonth() + 1).padStart(2, '0');
  const dd = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mm}-${dd}`;
}

const ESTADO_INICIAL = {
  tipo: 'saida',
  valor: '',
  classificacao: '',
  data: hojeIso(),
  status: 'pago',
  contaId: '',
  obs: '',
};

/**
 * Mesmos campos e mesma regra de status do formulário atual: em entrada,
 * "pago" vira "recebido" e "a pagar" vira "a receber".
 */
export function NovaTransacao({ contas, contaSugerida, aoFechar, aoSalvar }) {
  const [form, setForm] = useState(() => ({
    ...ESTADO_INICIAL,
    contaId: contaSugerida || '',
  }));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const primeiroCampo = useRef(null);

  useEffect(() => {
    primeiroCampo.current?.focus();
    const aoTeclar = (evento) => {
      if (evento.key === 'Escape') aoFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);

  const atualizar = (campo) => (evento) =>
    setForm((atual) => ({ ...atual, [campo]: evento.target.value }));

  const enviar = async (evento) => {
    evento.preventDefault();
    setErro(null);

    const valorNumero = Number(String(form.valor).replace(',', '.'));
    if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
      setErro('Informe um valor maior que zero.');
      return;
    }
    if (!form.classificacao.trim()) {
      setErro('Descreva o lançamento em "Descrição".');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.data)) {
      setErro('Informe uma data válida.');
      return;
    }

    const statusFinal =
      form.tipo === 'entrada'
        ? form.status === 'pago' ? 'recebido' : 'a_receber'
        : form.status;

    setSalvando(true);
    try {
      await criarTransacao({
        tipo: form.tipo,
        valor: valorNumero,
        classificacao: form.classificacao.trim(),
        data: form.data,
        status: statusFinal,
        obs: form.obs.trim() || null,
        conta_id: form.contaId || null,
      });
      await aoSalvar();
      aoFechar();
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar transação.');
      setSalvando(false);
    }
  };

  const entrada = form.tipo === 'entrada';

  return (
    <div
      className={estilos.fundo}
      role="dialog"
      aria-modal="true"
      aria-label="Nova transação"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      }}
    >
      <form className={estilos.painel} onSubmit={enviar}>
        <div className={estilos.topo}>
          <div>
            <h2 className={estilos.titulo}>Nova transação</h2>
            <p className={estilos.subtitulo}>Entra no painel assim que você salvar.</p>
          </div>
          <BotaoIcone rotulo="Fechar" onClick={aoFechar}>
            <Icone nome="fechar" tamanho={17} />
          </BotaoIcone>
        </div>

        <div className={estilos.campos}>
          <div className={estilos.campo}>
            <span className={estilos.rotulo}>Tipo</span>
            <div className={estilos.segmentado}>
              <button
                type="button"
                className={`${estilos.segmento} ${entrada ? estilos.segmentoEntrada : ''}`.trim()}
                onClick={() => setForm((a) => ({ ...a, tipo: 'entrada' }))}
                aria-pressed={entrada}
              >
                Entrada
              </button>
              <button
                type="button"
                className={`${estilos.segmento} ${!entrada ? estilos.segmentoSaida : ''}`.trim()}
                onClick={() => setForm((a) => ({ ...a, tipo: 'saida' }))}
                aria-pressed={!entrada}
              >
                Saída
              </button>
            </div>
          </div>

          <div className={estilos.campo}>
            <label className={estilos.rotulo} htmlFor="nt-descricao">
              Descrição
            </label>
            <input
              id="nt-descricao"
              ref={primeiroCampo}
              className={estilos.entrada}
              value={form.classificacao}
              onChange={atualizar('classificacao')}
              placeholder="Ex.: Venda balcão, Aluguel, Energia"
              maxLength={120}
            />
          </div>

          <div className={estilos.dupla}>
            <div className={estilos.campo}>
              <label className={estilos.rotulo} htmlFor="nt-valor">
                Valor (R$)
              </label>
              <input
                id="nt-valor"
                className={estilos.entrada}
                value={form.valor}
                onChange={atualizar('valor')}
                inputMode="decimal"
                placeholder="0,00"
              />
            </div>
            <div className={estilos.campo}>
              <label className={estilos.rotulo} htmlFor="nt-data">
                Data
              </label>
              <input
                id="nt-data"
                type="date"
                className={estilos.entrada}
                value={form.data}
                onChange={atualizar('data')}
              />
            </div>
          </div>

          <div className={estilos.dupla}>
            <div className={estilos.campo}>
              <label className={estilos.rotulo} htmlFor="nt-status">
                Situação
              </label>
              <select
                id="nt-status"
                className={estilos.selecao}
                value={form.status}
                onChange={atualizar('status')}
              >
                <option value="pago">{entrada ? 'Já recebi' : 'Já paguei'}</option>
                <option value="a_pagar">{entrada ? 'Vou receber' : 'Vou pagar'}</option>
              </select>
            </div>
            <div className={estilos.campo}>
              <label className={estilos.rotulo} htmlFor="nt-conta">
                Conta
              </label>
              <select
                id="nt-conta"
                className={estilos.selecao}
                value={form.contaId}
                onChange={atualizar('contaId')}
              >
                <option value="">Conta padrão</option>
                {contas.map((conta) => (
                  <option key={conta.id} value={conta.id}>
                    {conta.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={estilos.campo}>
            <label className={estilos.rotulo} htmlFor="nt-obs">
              Observação (opcional)
            </label>
            <input
              id="nt-obs"
              className={estilos.entrada}
              value={form.obs}
              onChange={atualizar('obs')}
              maxLength={240}
            />
          </div>

          {erro ? <p className={estilos.erro}>{erro}</p> : null}
        </div>

        <div className={estilos.acoes}>
          <Botao variante="fantasma" type="button" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar transação'}
          </Botao>
        </div>
      </form>
    </div>
  );
}
