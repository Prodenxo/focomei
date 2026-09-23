import {
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  GraduationCap,
  MessageCircle,
  Mic2,
  ReceiptText,
  Rocket,
} from 'lucide-react';

export const audiences = [
  {
    icon: BriefcaseBusiness,
    title: 'Contadores',
    tagline: 'Mais MEI. Mais margem. Menos esforço.',
    description: 'Escale sem contratar mais. Automação fiscal e receita recorrente previsível.',
  },
  {
    icon: GraduationCap,
    title: 'Estudantes',
    tagline: 'Construa sua carteira antes de pegar o diploma.',
    description: 'Atenda MEIs com ferramenta profissional enquanto ainda forma sua base.',
  },
  {
    icon: Rocket,
    title: 'Empreendedores',
    tagline: 'Um negócio lucrativo começa onde outros param de olhar.',
    description: 'Baixa barreira de entrada para montar uma operação sólida no mercado MEI.',
  },
];

export const benefits = [
  {
    icon: MessageCircle,
    title: 'NFS-e por WhatsApp',
    description: 'Emissão por áudio para simplificar a rotina do cliente.',
  },
  {
    icon: ReceiptText,
    title: 'DAS e obrigações',
    description: 'Guias, parcelamentos e acompanhamento fiscal sem depender de planilha.',
  },
  {
    icon: FileText,
    title: 'Painel web completo',
    description: 'Catálogo, certificado digital, limite de faturamento e histórico de notas.',
  },
];

export const faqs = [
  {
    question: 'Para quem é o Foco MEI?',
    answer: 'Para contadores, estudantes e empreendedores que atendem MEIs e querem organizar a operação em uma única plataforma.',
  },
  {
    question: 'Como funciona a emissão por áudio?',
    answer: 'O cliente envia as informações pelo WhatsApp e acompanha a emissão da NFS-e com menos etapas manuais.',
  },
  {
    question: 'Posso criar uma conta diretamente?',
    answer: 'O cadastro acontece somente por um link de convite com token válido. Para começar, solicite acesso à equipe.',
  },
  {
    question: 'Já sou cliente. Onde entro?',
    answer: 'Use o botão Entrar. Depois da autenticação, você será levado à visão geral protegida.',
  },
];

export function MarketingCard({ icon: Icon, title, tagline, description }) {
  return (
    <article className="group h-full rounded-2xl border border-[#0d2b5e]/10 bg-white p-6 shadow-[0_5px_20px_rgba(13,43,94,0.06)] transition duration-200 hover:-translate-y-1 hover:border-[#00a86b]/50 hover:shadow-[0_20px_45px_rgba(0,168,107,0.16)]">
      <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-[14px] border border-[#00a86b]/15 bg-[#00a86b]/10 text-[#008f5b] transition group-hover:scale-105 group-hover:bg-[#00a86b]/15">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      {tagline ? <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[#008f5b]">{title}</p> : null}
      <h3 className="text-lg font-extrabold leading-snug text-[#0d2b5e]">{tagline || title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#526276]">{description}</p>
    </article>
  );
}

export function ProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[330px] rounded-[28px] border border-white/10 bg-white/5 p-2 shadow-2xl">
      <div className="rounded-[22px] bg-[#0a2248] p-6 text-white">
        <div className="mb-5 flex items-center justify-between text-[10px] text-white/40">
          <span>9:41</span>
          <span>● ● ●</span>
        </div>
        <p className="text-[10px] font-extrabold tracking-[0.18em] text-white/45">PAINEL MEI</p>
        <p className="mt-1 text-4xl font-extrabold">15</p>
        <p className="text-xs text-white/50">notas emitidas este mês</p>
        <div className="my-5 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-[#00a86b]/15 p-3">
            <p className="font-extrabold text-[#20d493]">Em dia</p>
            <p className="text-[10px] text-white/45">DAS</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <p className="font-extrabold">72%</p>
            <p className="text-[10px] text-white/45">limite MEI</p>
          </div>
        </div>
        <div className="rounded-xl border border-[#00a86b]/30 bg-[#00a86b]/10 p-4">
          <p className="flex items-center gap-2 text-xs font-extrabold text-[#20d493]">
            <Mic2 className="h-4 w-4" /> WhatsApp · áudio
          </p>
          <p className="mt-2 text-xs leading-5 text-white/80">&quot;Emitir nota de consultoria, R$ 350, para João Silva.&quot;</p>
          <p className="mt-2 flex items-center gap-1 text-xs font-bold text-[#20d493]">
            <CheckCircle2 className="h-3.5 w-3.5" /> NFS-e autorizada
          </p>
        </div>
      </div>
    </div>
  );
}
