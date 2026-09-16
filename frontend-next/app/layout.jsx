import '@/styles/globals.css';
import { TemaProvider } from '@/components/tema/TemaProvider';

export const metadata = {
  title: 'Foco MEI — Visão Geral',
  description: 'Sua vida financeira em um só lugar.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

/** Evita piscar o tema claro antes da hidratação. */
const temaInicial = `
(function () {
  try {
    var salvo = window.localStorage.getItem('@financas_pessoais:theme');
    var escuro = salvo === 'dark'
      || ((!salvo || salvo === 'system')
        && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro';
    document.documentElement.style.colorScheme = escuro ? 'dark' : 'light';
  } catch (e) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" data-tema="claro" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: temaInicial }} />
      </head>
      <body>
        <TemaProvider>{children}</TemaProvider>
      </body>
    </html>
  );
}
