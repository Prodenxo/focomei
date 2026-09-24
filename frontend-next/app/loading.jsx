export default function RootLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--canvas)] px-4">
      <div
        className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] px-6 py-5 text-sm text-[var(--text-muted)] shadow-sm"
        role="status"
        aria-live="polite"
      >
        Carregando Foco MEI…
      </div>
    </main>
  );
}
