'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** Mesma chave e mesmos valores do app Expo (`frontend/store/themeStore.ts`). */
const CHAVE_TEMA = '@financas_pessoais:theme';
const PREFERENCIAS = ['light', 'dark', 'system'];

const TemaContext = createContext({
  preferencia: 'system',
  escuro: false,
  alternar: () => {},
  definir: () => {},
});

function lerPreferencia() {
  try {
    const salvo = window.localStorage.getItem(CHAVE_TEMA);
    return PREFERENCIAS.includes(salvo) ? salvo : 'system';
  } catch {
    return 'system';
  }
}

function sistemaEscuro() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function TemaProvider({ children }) {
  const [preferencia, setPreferencia] = useState('system');
  const [escuroDoSistema, setEscuroDoSistema] = useState(false);

  useEffect(() => {
    setPreferencia(lerPreferencia());
    setEscuroDoSistema(sistemaEscuro());

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const aoMudar = (evento) => setEscuroDoSistema(evento.matches);
    media.addEventListener('change', aoMudar);
    return () => media.removeEventListener('change', aoMudar);
  }, []);

  const escuro = preferencia === 'system' ? escuroDoSistema : preferencia === 'dark';

  useEffect(() => {
    document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro';
    document.documentElement.style.colorScheme = escuro ? 'dark' : 'light';
  }, [escuro]);

  const definir = useCallback((proxima) => {
    if (!PREFERENCIAS.includes(proxima)) return;
    setPreferencia(proxima);
    try {
      window.localStorage.setItem(CHAVE_TEMA, proxima);
    } catch {
      /* modo privado: só não persiste */
    }
  }, []);

  const alternar = useCallback(() => {
    definir(escuro ? 'light' : 'dark');
  }, [definir, escuro]);

  const valor = useMemo(
    () => ({ preferencia, escuro, alternar, definir }),
    [preferencia, escuro, alternar, definir],
  );

  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

export function useTema() {
  return useContext(TemaContext);
}
