"use client";

import { useMemo, useState } from "react";

const WHATSAPP_URL =
  "https://wa.me/5521983992146?text=" +
  encodeURIComponent("Olá! Quero conhecer a FocoMEI para o meu escritório.");

const features = [
  ["✦", "Notas fiscais pelo WhatsApp", "O cliente envia um áudio e recebe a nota pronta. Simples para ele, escalável para o escritório."],
  ["↻", "DAS no automático", "Envio mensal, acompanhamento e menos chamados repetitivos na sua equipe."],
  ["◫", "Financeiro completo", "Contas a pagar e receber, recibos e visão clara do negócio do MEI."],
  ["⌁", "Agenda integrada", "Compromissos organizados e sincronizados com o Google Agenda."],
  ["▦", "Estoque e cadastros", "Produtos, clientes e movimentações reunidos em um único lugar."],
  ["✓", "Jornada do MEI", "Abertura, alteração, regularização e encerramento com apoio do contador."],
];

export default function Home() {
  const [clients, setClients] = useState(100);
  const [margin, setMargin] = useState(20);
  const monthly = useMemo(() => clients * margin, [clients, margin]);

  return (
    <main>
      <section className="hero" id="inicio">
        <div className="grid-bg" />
        <header className="nav shell">
          <a className="brand" href="#inicio">Foco<span>MEI</span></a>
          <nav aria-label="Navegação principal">
            <a href="#funcionalidades">Funcionalidades</a>
            <a href="#receita">Como ganhar mais</a>
            <a href="#contador">Para o contador</a>
          </nav>
          <a
            className="btn outline"
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Falar com especialista <b>→</b>
          </a>
        </header>

        <div className="hero-content shell">
          <div className="hero-copy">
            <p className="eyebrow">Tecnologia que transforma MEIs em receita</p>
            <h1>Transforme sua carteira de MEIs em <span>uma nova fonte de receita</span></h1>
            <p className="lead">Automatize a operação, entregue mais valor e crie receita recorrente sem aumentar a equipe.</p>
            <a
              className="btn primary"
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Quero conhecer a FocoMEI <b>→</b>
            </a>
            <div className="proof"><i>●</i><strong>+1.000</strong><span>usuários ativos</span></div>
          </div>

          <div className="dashboard" aria-hidden="true">
            <aside>
              <div className="dash-logo">Foco<span>MEI</span></div>
              {["⌂  Visão geral", "◎  Clientes", "↻  Automação", "▤  Obrigações", "□  Notas fiscais", "$  Financeiro"].map((x, i) =>
                <div className={i === 0 ? "active" : ""} key={x}>{x}</div>
              )}
              <small><b>♛</b> Mais receita.<br/>Menos trabalho operacional.</small>
            </aside>
            <div className="dash-main">
              <div className="dash-title"><div><small>PAINEL DO CONTADOR</small><h2>Visão geral</h2></div><span>Últimos 30 dias⌄</span></div>
              <div className="metrics">
                <article><span>Receita recorrente</span><strong>R$ 48.750</strong><em>↑ 23,6%</em></article>
                <article><span>Clientes MEI</span><strong>1.248</strong><em>↑ 18,4%</em></article>
                <article><span>Automações hoje</span><strong>378</strong><em>↑ 32,7%</em></article>
              </div>
              <div className="dash-bottom">
                <article className="chart">
                  <span>Receita recorrente (MRR)</span><strong>R$ 48.750</strong>
                  <svg viewBox="0 0 500 190" role="img" aria-label="Crescimento da receita recorrente">
                    <defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#37e58d" stopOpacity=".45"/><stop offset="1" stopColor="#37e58d" stopOpacity="0"/></linearGradient></defs>
                    <path className="area" d="M0 165 C65 130 80 120 130 127 S200 96 245 104 S310 66 355 76 S420 30 500 22 L500 190 L0 190Z"/>
                    <path className="stroke" d="M0 165 C65 130 80 120 130 127 S200 96 245 104 S310 66 355 76 S420 30 500 22"/>
                  </svg>
                </article>
                <article className="activity">
                  <b>Atividades recentes</b>
                  {[["↗","DAS enviado","123 clientes"],["▤","Nota emitida","28 notas"],["+","Cliente ativado","Empresa de TI"]].map(x =>
                    <div key={x[1]}><i>{x[0]}</i><span><strong>{x[1]}</strong><small>{x[2]}</small></span><em>Concluído</em></div>
                  )}
                </article>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section light" id="funcionalidades">
        <div className="shell">
          <div className="section-head"><p className="eyebrow">Uma plataforma. Uma operação inteira.</p><h2>Tudo que o seu cliente MEI precisa.<br/><span>Sem tudo cair no seu colo.</span></h2></div>
          <div className="feature-grid">
            {features.map(([icon, title, text]) => <article key={title}><i>{icon}</i><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="section revenue" id="receita">
        <div className="shell revenue-grid">
          <div>
            <p className="eyebrow">Automação que aparece no faturamento</p>
            <h2>O MEI deixa de ser um problema operacional e vira uma <span>carteira rentável.</span></h2>
            <p className="lead">Você pode agregar a solução ao seu plano, aumentar o ticket, atender mais clientes com a mesma estrutura e abrir portas para novos serviços contábeis.</p>
            <div className="money-list">
              <div><b>01</b><span><strong>Aumente o ticket médio</strong>Inclua tecnologia e conveniência na sua entrega.</span></div>
              <div><b>02</b><span><strong>Ganhe escala</strong>Reduza tarefas repetitivas que consomem a equipe.</span></div>
              <div><b>03</b><span><strong>Retenha e faça upsell</strong>Conheça melhor o cliente e antecipe sua evolução.</span></div>
            </div>
          </div>
          <div className="calculator">
            <p>SIMULE UMA OPORTUNIDADE</p>
            <h3>Quanto sua carteira pode gerar?</h3>
            <label>Clientes MEI <strong>{clients}</strong></label>
            <input aria-label="Quantidade de clientes MEI" type="range" min="20" max="500" step="10" value={clients} onChange={e => setClients(Number(e.target.value))}/>
            <label>Margem mensal por cliente <strong>R$ {margin}</strong></label>
            <input aria-label="Margem mensal por cliente" type="range" min="5" max="100" step="5" value={margin} onChange={e => setMargin(Number(e.target.value))}/>
            <div className="result"><span>Potencial de receita recorrente</span><strong>{monthly.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}<small>/mês</small></strong><em>{(monthly*12).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})} por ano</em></div>
            <small className="disclaimer">Simulação ilustrativa. O resultado depende da estratégia comercial e da precificação do escritório.</small>
          </div>
        </div>
      </section>

      <section className="section light" id="contador">
        <div className="shell split">
          <div className="quote-card"><span>“</span><strong>Seu cliente quer facilidade. Seu escritório precisa de escala. A FocoMEI conecta os dois.</strong></div>
          <div><p className="eyebrow">Feita para o contador crescer</p><h2>Mais valor percebido.<br/><span>Menos esforço invisível.</span></h2><p>O cliente resolve a rotina com autonomia, enquanto você fortalece o relacionamento, melhora sua margem e posiciona o escritório como parceiro de crescimento.</p></div>
        </div>
      </section>

      <section className="cta-section" id="demonstracao">
        <div className="shell cta-card">
          <p className="eyebrow">O próximo passo da sua carteira de MEIs</p>
          <h2>Pare de vender apenas obrigação.<br/><span>Comece a entregar evolução.</span></h2>
          <p>Conheça a FocoMEI e descubra o modelo ideal para transformar tecnologia em receita no seu escritório.</p>
          <a
            className="btn primary"
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Quero falar com um especialista <b>→</b>
          </a>
        </div>
      </section>
      <footer>
        <div className="shell">
          <div className="brand">Foco<span>MEI</span></div>
          <p>Tecnologia para o contador crescer junto com o MEI.</p>
          <a
            className="footer-wa"
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp (21) 98399-2146
          </a>
          <span>© 2026 FocoMEI</span>
        </div>
      </footer>
    </main>
  );
}
