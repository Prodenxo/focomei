export function AppFooter() {
  return (
    <footer className="mt-8 flex flex-col gap-2 border-t border-[var(--card-border)] py-6 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
      <p>© {new Date().getFullYear()} Foco MEI. Todos os direitos reservados.</p>
      <p>Seu MEI organizado, simples e seguro.</p>
    </footer>
  );
}
