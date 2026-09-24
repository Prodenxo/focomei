import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--canvas)] px-4">
      <section className="w-full max-w-md rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-[var(--accent)]">Página não encontrada</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
          Este endereço não existe
        </h1>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Volte ao início para continuar usando o Foco MEI.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Voltar ao início
        </Link>
      </section>
    </main>
  );
}
