'use client';

import Link from 'next/link';
import { ArrowRight, Check, Mic2 } from 'lucide-react';
import { BrandWordmark } from '@/components/brand/BrandLogo';
import { ACCESS_REQUEST_HREF, LOGIN_HREF } from '@/lib/appRoutes';
import {
  audiences,
  benefits,
  faqs,
  MarketingCard,
  ProductMockup,
} from '@/components/landing/LandingSections';

const container = 'mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10';

function PrimaryLink({ href, children, inverse = false }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
        inverse
          ? 'border border-white/25 text-white hover:bg-white/10 focus-visible:outline-white'
          : 'bg-[#00a86b] text-white shadow-lg shadow-[#00a86b]/20 hover:bg-[#008f5b] focus-visible:outline-[#00a86b]'
      }`}
    >
      {children}
    </Link>
  );
}

function SectionHeading({ eyebrow, children, centered = false }) {
  return (
    <div className={centered ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className="text-xs font-extrabold tracking-[0.2em] text-[#008f5b]">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-[#0d2b5e] sm:text-4xl">
        {children}
      </h2>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f4f7fa] text-[#26384c]">
      <header className="border-b border-white/10 bg-[#0d2b5e]">
        <nav className={`${container} flex min-h-18 items-center justify-between gap-3 py-3`} aria-label="Navegação principal">
          <Link href="/" aria-label="Foco MEI — página inicial">
            <BrandWordmark />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href={LOGIN_HREF} className="rounded-lg px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/10 hover:text-white">
              Entrar
            </Link>
            <Link href={ACCESS_REQUEST_HREF} className="rounded-xl bg-[#00a86b] px-3 py-2.5 text-center text-xs font-bold text-white hover:bg-[#008f5b] sm:px-5 sm:text-sm">
              Quero ser cliente
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="bg-[#0d2b5e] py-16 text-white sm:py-20 lg:py-24">
          <div className={`${container} grid items-center gap-14 lg:grid-cols-[1fr_380px]`}>
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#00a86b]/30 bg-[#00a86b]/10 px-4 py-2 text-xs text-white/85">
                <span className="h-2 w-2 rounded-full bg-[#20d493]" />
                Tecnologia para quem atende MEI
              </p>
              <h1 className="mt-6 text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
                O MEI sempre foi lucrativo. <span className="text-[#20d493]">Agora você vai provar.</span>
              </h1>
              <p className="mt-5 text-lg font-bold text-[#20d493]">Foco, Tecnologia e Movimento</p>
              <p className="mt-3 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
                Automação de DAS e nota fiscal, inclusive por áudio no WhatsApp. Receita recorrente, previsível e escalável para quem leva o MEI a sério.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <PrimaryLink href={ACCESS_REQUEST_HREF}>
                  Quero ser cliente <ArrowRight className="h-4 w-4" />
                </PrimaryLink>
                <PrimaryLink href={LOGIN_HREF} inverse>Já sou cliente</PrimaryLink>
              </div>
            </div>
            <div className="hidden lg:block"><ProductMockup /></div>
          </div>
        </section>

        <section className="bg-[#0a2248] py-9 text-white">
          <div className={`${container} grid gap-7 text-center sm:grid-cols-3`}>
            {[
              ['15M+', 'CNPJs MEI no Brasil'],
              ['70%', 'de todas as empresas'],
              ['1ª', 'NFS-e por áudio no WhatsApp'],
            ].map(([number, label]) => (
              <div key={label}>
                <p className="text-3xl font-extrabold text-[#20d493]">{number}</p>
                <p className="mt-1 text-xs text-white/55">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white py-16 sm:py-20" id="publicos">
          <div className={container}>
            <SectionHeading eyebrow="PARA QUEM">Quem transforma MEI em negócio lucrativo</SectionHeading>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {audiences.map((item) => <MarketingCard key={item.title} {...item} />)}
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className={`${container} grid items-center gap-10 lg:grid-cols-2`}>
            <div>
              <SectionHeading eyebrow="DIFERENCIAL">Nota fiscal por áudio. Só no Foco MEI.</SectionHeading>
              <p className="mt-6 max-w-xl text-base leading-7 text-[#526276]">
                O MEI manda um áudio no WhatsApp. O sistema organiza a emissão da nota, integrando a rotina fiscal sem planilha e sem fricção.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {['Menos etapas manuais', 'DAS e NFS-e na mesma rotina', 'Histórico acessível pelo painel web'].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00a86b]/10 text-[#008f5b]"><Check className="h-4 w-4" /></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-[#00a86b]/25 bg-[#eaf8f3] p-7 sm:p-10">
              <Mic2 className="h-10 w-10 text-[#008f5b]" />
              <p className="mt-5 text-2xl font-extrabold leading-tight text-[#0d2b5e]">DAS + NFS-e integrados à rotina do cliente.</p>
              <p className="mt-3 leading-7 text-[#526276]">Tecnologia prática para atender mais MEIs com organização e consistência.</p>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 sm:py-20">
          <div className={container}>
            <SectionHeading eyebrow="BENEFÍCIOS" centered>O sistema cuida do MEI. Você cuida do crescimento.</SectionHeading>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {benefits.map((item) => <MarketingCard key={item.title} {...item} />)}
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className={`${container} max-w-4xl`}>
            <SectionHeading eyebrow="PERGUNTAS FREQUENTES" centered>Antes de começar</SectionHeading>
            <div className="mt-10 space-y-3">
              {faqs.map((item) => (
                <details key={item.question} className="group rounded-2xl border border-[#0d2b5e]/10 bg-white p-5 shadow-sm">
                  <summary className="cursor-pointer list-none pr-8 font-bold text-[#0d2b5e] marker:content-none">{item.question}</summary>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[#526276]">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#0d2b5e] py-16 text-center text-white sm:py-20">
          <div className={`${container} flex flex-col items-center`}>
            <h2 className="text-3xl font-extrabold sm:text-4xl">Mais MEI. Mais margem. Menos esforço.</h2>
            <p className="mt-4 max-w-2xl leading-7 text-white/70">Solicite acesso para conhecer a plataforma ou entre se você já faz parte do Foco MEI.</p>
            <div className="mt-8 flex w-full max-w-md flex-col justify-center gap-3 sm:flex-row">
              <PrimaryLink href={ACCESS_REQUEST_HREF}>Quero ser cliente</PrimaryLink>
              <PrimaryLink href={LOGIN_HREF} inverse>Entrar</PrimaryLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#0a2248] py-10 text-white">
        <div className={`${container} flex flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left`}>
          <BrandWordmark compact />
          <div className="text-xs text-white/50">
            <div className="mb-2 flex justify-center gap-4 sm:justify-end">
              <Link href="/privacidade" className="hover:text-white">Política de Privacidade</Link>
              <Link href="/termos" className="hover:text-white">Termos de Uso</Link>
            </div>
            <p>© 2026 Foco MEI. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
