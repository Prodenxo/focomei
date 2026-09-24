'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[global error]', error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">Não foi possível abrir o Foco MEI</h1>
            <p className="mt-3 text-sm text-slate-600">
              Tente novamente. Se continuar, recarregue a página.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Tentar novamente
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
