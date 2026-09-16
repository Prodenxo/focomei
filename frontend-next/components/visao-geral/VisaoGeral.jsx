'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Botao } from '@/components/ui/Botao';
import { FiltroContas } from '@/components/ui/FiltroContas';
import { Icone } from '@/components/ui/Icone';
import { useRequisicao } from '@/hooks/useRequisicao';
import { useSessao } from '@/hooks/useSessao';
import {
  fetchCategorias,
  fetchContas,
  fetchMatrizDre,
  fetchOrcamentosAnuais,
  fetchResumoOrcamentos,
  fetchTransacoes,
} from '@/services/visaoGeral';
import { isInSelectedMonth } from '@/lib/finance/transactionPeriodFilter';
import {
  buildContaNameMap,
  computeLegacyBalance,
  computeSaldosByConta,
  filterTransactionsByConta,
  resolveDashboardBalance,
} from '@/lib/finance/contaFinanceiraIntegration';
import {
  buildDashboardInsights,
  buildRecentActivity,
  buildTodayFlow,
} from '@/lib/finance/dashboardInsights';
import {
  bucketBudgets,
  buildBpoCategorySeries,
  buildCategorizedBudgets,
  buildDespesasPorCategoria,
  buildSaldoSeries,
  computeMonthRealizedFlow,
} from '@/lib/finance/visaoGeral';
import { buildBpoMatrixViewModel } from '@/lib/finance/bpoMatrix';
import { pickDefaultContaFinanceira } from '@/lib/finance/contaPadrao';
import { Cabecalho } from './Cabecalho';
import { CartaoSaldo } from './CartaoSaldo';
import { ResumoIndicadores } from './Indicadores';
import { EvolucaoSaldo } from './EvolucaoSaldo';
import { UltimasMovimentacoes } from './UltimasMovimentacoes';
import { MovimentacaoHoje } from './MovimentacaoHoje';
import { MovimentacoesMes } from './MovimentacoesMes';
import { Orcamento } from './Orcamento';
import { ContaGlobal, SolicitacoesAcesso } from './ContaGlobal';
import { NovaTransacao } from './NovaTransacao';
import { VisaoBpo } from './VisaoBpo';
import estilos from './VisaoGeral.module.css';

const BPO_ANO_MINIMO = 2020;

export function VisaoGeral() {
  const { sessao, estado, primeiroNome } = useSessao();
  const autenticado = estado === 'pronta';

  const agora = useMemo(() => new Date(), []);
  const [mes, setMes] = useState(() => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  }));
  const [filtroConta, setFiltroConta] = useState('all');
  const [saldoVisivel, setSaldoVisivel] = useState(true);
  const [abaSaidas, setAbaSaidas] = useState('pagos');
  const [abaOrcamento, setAbaOrcamento] = useState('saida');
  const [bpoAtivo, setBpoAtivo] = useState(false);
  const [bpoModo, setBpoModo] = useState('matriz');
  const [bpoAno, setBpoAno] = useState(() => new Date().getFullYear());
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    if (estado === 'sem-sessao') {
      window.location.replace('/login');
    }
  }, [estado]);

  const transacoes = useRequisicao(fetchTransacoes, [autenticado], {
    inicial: [],
    ativo: autenticado,
  });
  const contas = useRequisicao(fetchContas, [autenticado], { inicial: [], ativo: autenticado });
  const categorias = useRequisicao(fetchCategorias, [autenticado], {
    inicial: { categoriasMap: {}, categoriasTipoMap: {}, lista: [] },
    ativo: autenticado,
  });

  const buscarResumo = useCallback((signal) => fetchResumoOrcamentos(mes, signal), [mes]);
  const resumoOrcamentos = useRequisicao(buscarResumo, [autenticado, mes.year, mes.month], {
    inicial: [],
    ativo: autenticado,
  });

  const buscarMatriz = useCallback((signal) => fetchMatrizDre(bpoAno, signal), [bpoAno]);
  const matrizCelulas = useRequisicao(buscarMatriz, [autenticado, bpoAtivo, bpoAno], {
    inicial: [],
    ativo: autenticado && bpoAtivo,
  });

  const buscarAnuais = useCallback((signal) => fetchOrcamentosAnuais(bpoAno, signal), [bpoAno]);
  const orcamentosAnuais = useRequisicao(buscarAnuais, [autenticado, bpoAtivo, bpoAno], {
    inicial: [],
    ativo: autenticado && bpoAtivo,
  });

  const recarregarTudo = useCallback(async () => {
    transacoes.recarregar();
    contas.recarregar();
    resumoOrcamentos.recarregar();
    if (bpoAtivo) {
      matrizCelulas.recarregar();
      orcamentosAnuais.recarregar();
    }
  }, [transacoes, contas, resumoOrcamentos, matrizCelulas, orcamentosAnuais, bpoAtivo]);

  const listaTransacoes = transacoes.dados || [];
  const listaContas = contas.dados || [];
  const { categoriasMap, categoriasTipoMap, lista: listaCategorias } = categorias.dados;

  const contasAtivas = useMemo(() => listaContas.filter((c) => c.ativo), [listaContas]);
  const contaNameById = useMemo(() => buildContaNameMap(contasAtivas), [contasAtivas]);
  const saldosByContaId = useMemo(
    () => computeSaldosByConta(contasAtivas, listaTransacoes),
    [contasAtivas, listaTransacoes],
  );
  const contasComSaldo = useMemo(
    () =>
      contasAtivas.map((c) => ({ ...c, saldoAtual: saldosByContaId[c.id] ?? c.saldo_inicial })),
    [contasAtivas, saldosByContaId],
  );

  const transacoesFiltradas = useMemo(
    () => filterTransactionsByConta(listaTransacoes, filtroConta),
    [listaTransacoes, filtroConta],
  );

  const saldoLegado = useMemo(() => computeLegacyBalance(listaTransacoes), [listaTransacoes]);
  const saldoMeta = useMemo(
    () => resolveDashboardBalance(contasAtivas, listaTransacoes, saldoLegado, filtroConta),
    [contasAtivas, listaTransacoes, saldoLegado, filtroConta],
  );

  const rotuloSaldo =
    filtroConta === 'all'
      ? saldoMeta.mode === 'contas'
        ? 'Saldo nas contas'
        : 'Saldo geral'
      : filtroConta === 'unassigned'
        ? 'Meu financeiro'
        : contaNameById[filtroConta] || 'Conta';

  const dicaSaldo =
    filtroConta === 'all'
      ? saldoMeta.mode === 'contas'
        ? 'Soma dos saldos cadastrados'
        : 'Acumulado'
      : filtroConta === 'unassigned'
        ? 'Sem vínculo com conta bancária'
        : 'Filtrado nesta visão';

  const transacoesDoMes = useMemo(
    () => transacoesFiltradas.filter((t) => isInSelectedMonth(t, mes)),
    [transacoesFiltradas, mes],
  );

  const { totalIncome, totalExpenses } = useMemo(
    () => computeMonthRealizedFlow(transacoesDoMes),
    [transacoesDoMes],
  );

  const { dayKeys, saldoData } = useMemo(
    () => buildSaldoSeries(transacoesDoMes),
    [transacoesDoMes],
  );

  const saidas = useMemo(() => buildDespesasPorCategoria(transacoesDoMes), [transacoesDoMes]);

  const insights = useMemo(
    () => buildDashboardInsights(transacoesFiltradas, mes.year, mes.month),
    [transacoesFiltradas, mes],
  );

  const recentes = useMemo(
    () => buildRecentActivity(transacoesFiltradas, mes.year, mes.month, categoriasMap, 6),
    [transacoesFiltradas, mes, categoriasMap],
  );

  const fluxoHoje = useMemo(() => buildTodayFlow(transacoesFiltradas), [transacoesFiltradas]);

  const orcamentosCategorizados = useMemo(
    () => buildCategorizedBudgets(resumoOrcamentos.dados || [], categoriasMap, categoriasTipoMap),
    [resumoOrcamentos.dados, categoriasMap, categoriasTipoMap],
  );
  const faixasOrcamento = useMemo(
    () => bucketBudgets(orcamentosCategorizados, abaOrcamento),
    [orcamentosCategorizados, abaOrcamento],
  );
  const temAlgumOrcamento = useMemo(
    () =>
      faixasOrcamento.verde.length
      + faixasOrcamento.amarelo.length
      + faixasOrcamento.laranja.length
      + faixasOrcamento.vermelho.length > 0,
    [faixasOrcamento],
  );

  const matrizBpo = useMemo(
    () =>
      buildBpoMatrixViewModel(
        listaCategorias,
        matrizCelulas.dados || [],
        transacoesFiltradas,
        bpoAno,
      ),
    [listaCategorias, matrizCelulas.dados, transacoesFiltradas, bpoAno],
  );

  const seriesBpo = useMemo(
    () =>
      buildBpoCategorySeries(
        orcamentosAnuais.dados || [],
        transacoesFiltradas,
        bpoAno,
        categoriasTipoMap,
        categoriasMap,
      ),
    [orcamentosAnuais.dados, transacoesFiltradas, bpoAno, categoriasTipoMap, categoriasMap],
  );

  const contaSugerida = useMemo(
    () => (filtroConta !== 'all' && filtroConta !== 'unassigned'
      ? filtroConta
      : pickDefaultContaFinanceira(contasAtivas)?.id || ''),
    [filtroConta, contasAtivas],
  );

  const carregandoPrincipal = transacoes.carregando || contas.carregando;
  const erroPrincipal = transacoes.erro || contas.erro;

  const voltarMes = () =>
    setMes(({ year, month }) => {
      const anterior = new Date(year, month - 2, 1);
      return { year: anterior.getFullYear(), month: anterior.getMonth() + 1 };
    });

  const avancarMes = () =>
    setMes(({ year, month }) => {
      const proximo = new Date(year, month, 1);
      return { year: proximo.getFullYear(), month: proximo.getMonth() + 1 };
    });

  if (estado === 'verificando' || estado === 'sem-sessao') {
    return (
      <main className={estilos.pagina}>
        <p className={estilos.avisoSessao}>
          {estado === 'verificando' ? 'Verificando sua sessão…' : 'Redirecionando para o login…'}
        </p>
      </main>
    );
  }

  const legendaBpo =
    filtroConta === 'all'
      ? 'Orçamento x realizado por categoria'
      : filtroConta === 'unassigned'
        ? 'Meu financeiro · lançamentos sem conta bancária'
        : `${contaNameById[filtroConta] || 'Conta'} · orçamento x realizado`;

  return (
    <div className={estilos.pagina}>
      <main className={estilos.conteudo}>
        <Cabecalho
          nome={primeiroNome}
          mes={mes}
          aoVoltarMes={voltarMes}
          aoAvancarMes={avancarMes}
          mostrarBpo
          bpoAtivo={bpoAtivo}
          aoAlternarBpo={() => setBpoAtivo((atual) => !atual)}
          aoNovaTransacao={() => setModalAberto(true)}
        />

        <FiltroContas
          contas={contasComSaldo}
          filtro={filtroConta}
          aoFiltrar={setFiltroConta}
          hrefConfiguracoes="/contas"
        />

        {erroPrincipal ? (
          <div className={estilos.faixaErro} role="alert">
            <span>
              Não foi possível carregar seus dados: {erroPrincipal.message}
            </span>
            <Botao variante="secundario" pequeno onClick={recarregarTudo}>
              <Icone nome="atualizar" tamanho={14} />
              Tentar de novo
            </Botao>
          </div>
        ) : null}

        {bpoAtivo ? (
          <VisaoBpo
            ano={bpoAno}
            anoMinimo={BPO_ANO_MINIMO}
            anoMaximo={agora.getFullYear()}
            aoVoltarAno={() => setBpoAno((ano) => Math.max(BPO_ANO_MINIMO, ano - 1))}
            aoAvancarAno={() => setBpoAno((ano) => Math.min(agora.getFullYear(), ano + 1))}
            modo={bpoModo}
            aoTrocarModo={setBpoModo}
            matriz={matrizBpo}
            carregandoMatriz={matrizCelulas.carregando || categorias.carregando}
            erroMatriz={matrizCelulas.erro?.message || null}
            aoRecarregarMatriz={matrizCelulas.recarregar}
            series={seriesBpo}
            carregandoSeries={orcamentosAnuais.carregando}
            legenda={legendaBpo}
          />
        ) : (
          <>
            <section className={estilos.destaques}>
              <CartaoSaldo
                rotulo={rotuloSaldo}
                dica={dicaSaldo}
                valor={saldoMeta.value}
                totalIncome={totalIncome}
                totalExpenses={totalExpenses}
                carregando={carregandoPrincipal}
                visivel={saldoVisivel}
                aoAlternarVisibilidade={() => setSaldoVisivel((atual) => !atual)}
              />
              <ResumoIndicadores insights={insights} carregando={carregandoPrincipal} />
            </section>

            <section className={estilos.duasColunas}>
              <EvolucaoSaldo
                etiqueta={rotuloSaldo}
                dayKeys={dayKeys}
                saldoData={saldoData}
                carregando={carregandoPrincipal}
              />
              <UltimasMovimentacoes
                itens={recentes}
                contaNameById={contaNameById}
                carregando={carregandoPrincipal}
                hrefTodas="/transacoes"
                aoNovaTransacao={() => setModalAberto(true)}
              />
            </section>

            <section className={estilos.duasColunas}>
              <MovimentacoesMes
                aba={abaSaidas}
                aoTrocarAba={setAbaSaidas}
                porCategoria={
                  abaSaidas === 'pagos'
                    ? saidas.expensesByCategoryPagos
                    : saidas.expensesByCategoryAPagar
                }
                total={abaSaidas === 'pagos' ? saidas.totalPagos : saidas.totalAPagar}
                categoriasMap={categoriasMap}
                carregando={carregandoPrincipal}
              />
              <MovimentacaoHoje
                fluxo={fluxoHoje}
                carregando={carregandoPrincipal}
                hrefAgenda="/agenda"
                aoNovaTransacao={() => setModalAberto(true)}
              />
            </section>

            <Orcamento
              aba={abaOrcamento}
              aoTrocarAba={setAbaOrcamento}
              faixas={faixasOrcamento}
              temAlgum={temAlgumOrcamento}
              carregando={resumoOrcamentos.carregando}
              hrefOrcamentos="/orcamentos"
            />

            <section className={estilos.duasColunas}>
              <ContaGlobal href="/conta-global" />
              {sessao?.role === 'superadmin' ? (
                <SolicitacoesAcesso href="/solicitacoes" />
              ) : null}
            </section>
          </>
        )}
      </main>

      {modalAberto ? (
        <NovaTransacao
          contas={contasAtivas}
          contaSugerida={contaSugerida}
          aoFechar={() => setModalAberto(false)}
          aoSalvar={recarregarTudo}
        />
      ) : null}
    </div>
  );
}
