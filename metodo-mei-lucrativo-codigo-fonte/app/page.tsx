const whatsappUrl =
  "https://chat.whatsapp.com/DgDeI3bLBfP2BubJWRXDzB?s=sw&p=i&ilr=0";

const learning = [
  "Como ganhar dinheiro atendendo clientes MEI.",
  "Como reduzir o tempo gasto com atendimento operacional.",
  "Como escalar esse serviço sem aumentar a equipe.",
  "Como transformar clientes de baixo ticket em receita recorrente.",
];

const audience = [
  "Contadores.",
  "Donos de escritórios contábeis.",
  "Profissionais que atendem ou desejam atender clientes MEI.",
  "Quem busca aumentar o faturamento sem depender apenas da prospecção tradicional.",
];

const discoveries = [
  "Por que muitos contadores acreditam que MEI não dá dinheiro.",
  "Os erros que tornam esse modelo pouco lucrativo.",
  "Como estruturar um processo escalável para atender centenas de clientes.",
  "Como aumentar o faturamento mantendo uma operação eficiente.",
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 12 3.2 3.2L17.5 8" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.4-4.2a8.5 8.5 0 1 1 15.6-4.6Z" />
      <path d="M8.4 7.7c.2-.4.4-.4.7-.4h.4c.2 0 .4.1.5.4l.8 2c.1.3.1.5-.1.7l-.6.7c-.2.2-.1.4 0 .6.6 1.1 1.5 2 2.7 2.6.2.1.4.1.6-.1l.8-1c.2-.2.4-.3.7-.2l2 .9c.3.1.4.3.4.5 0 .3-.2 1.5-1.1 2.1-.5.4-1.3.7-2.2.5-1.1-.2-2.5-.7-4.2-2.2-1.4-1.3-2.4-2.8-2.7-4-.4-1.2 0-2.4.4-2.9l.9-.2Z" />
    </svg>
  );
}

function CTA({ final = false }: { final?: boolean }) {
  return (
    <a
      className={`cta ${final ? "cta-final" : ""}`}
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Entrar no grupo gratuito do WhatsApp"
    >
      <WhatsAppIcon />
      <span>{final ? "Quero participar gratuitamente" : "Entrar no Grupo Gratuito do WhatsApp"}</span>
      <ArrowIcon />
    </a>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>
          <span className="check">
            <CheckIcon />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="container hero-inner">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            Workshop online e gratuito para contadores
          </div>
          <h1>
            Método <span>MEI Lucrativo</span>
            <br /> para Contadores
          </h1>
          <p className="hero-copy">
            Descubra como transformar clientes MEI em uma nova fonte de
            faturamento recorrente para o seu escritório, utilizando processos
            simples e tecnologia.
          </p>
          <CTA />
          <p className="microcopy">
            <CheckIcon /> Acesso gratuito · Informações e materiais pelo grupo
          </p>
        </div>
      </section>

      <section className="content-section">
        <div className="container">
          <div className="section-heading">
            <span className="section-number">01</span>
            <div>
              <p className="kicker">Conteúdo prático</p>
              <h2>Você vai aprender</h2>
            </div>
          </div>
          <div className="feature-grid">
            {learning.map((item, index) => (
              <article className="feature-card" key={item}>
                <span className="card-number">0{index + 1}</span>
                <div className="card-icon">
                  <CheckIcon />
                </div>
                <p>{item}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="split-section">
        <div className="container split-grid">
          <div className="split-intro">
            <p className="kicker">Feito para você</p>
            <h2>Para quem é este workshop?</h2>
            <p>
              Para profissionais que querem enxergar o MEI como uma
              oportunidade de crescimento — e não como trabalho operacional.
            </p>
          </div>
          <div className="list-panel">
            <List items={audience} />
          </div>
        </div>
      </section>

      <section className="discover-section">
        <div className="container discover-grid">
          <div className="discover-panel">
            <span className="big-number">100</span>
            <span className="big-label">clientes com uma operação escalável</span>
            <div className="line" />
            <p>
              O problema nunca foi o MEI. É o modelo de atendimento que define
              se ele gera trabalho ou lucro.
            </p>
          </div>
          <div className="discover-copy">
            <p className="kicker">Mudança de perspectiva</p>
            <h2>O que você vai descobrir</h2>
            <p className="section-copy">
              Durante o workshop, você entenderá os fundamentos de uma operação
              mais eficiente, previsível e lucrativa.
            </p>
            <List items={discoveries} />
          </div>
        </div>
      </section>

      <section className="final-section">
        <div className="container final-card">
          <div className="final-shape" />
          <div className="eyebrow eyebrow-light">
            <span className="eyebrow-dot" />
            Inscrições abertas
          </div>
          <h2>As vagas são gratuitas, mas o grupo será fechado antes do evento.</h2>
          <p>
            Entre agora no grupo do WhatsApp para receber todas as informações,
            materiais e o acesso ao workshop.
          </p>
          <CTA final />
          <span className="final-note">Leva menos de 10 segundos para entrar.</span>
        </div>
      </section>

      <footer>
        <div className="container">
          <span>Método MEI Lucrativo para Contadores</span>
          <span>Workshop gratuito</span>
        </div>
      </footer>
    </main>
  );
}
