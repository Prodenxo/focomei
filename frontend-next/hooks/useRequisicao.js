'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbortError } from '@/lib/api';

/**
 * Busca com cancelamento e descarte por id: só a requisição mais recente pode
 * escrever no estado, então trocar de filtro rápido nunca traz dado velho de volta.
 */
export function useRequisicao(buscar, deps, { inicial = null, ativo = true } = {}) {
  const [dados, setDados] = useState(inicial);
  const [carregando, setCarregando] = useState(ativo);
  const [erro, setErro] = useState(null);

  const idAtual = useRef(0);
  const abortRef = useRef(null);
  const buscarRef = useRef(buscar);
  buscarRef.current = buscar;

  const executar = useCallback(() => {
    if (!ativo) {
      setCarregando(false);
      return undefined;
    }

    const id = idAtual.current + 1;
    idAtual.current = id;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCarregando(true);
    setErro(null);

    buscarRef
      .current(controller.signal)
      .then((resultado) => {
        if (id !== idAtual.current) return;
        setDados(resultado);
        setCarregando(false);
      })
      .catch((e) => {
        if (isAbortError(e) || id !== idAtual.current) return;
        setErro(e);
        setCarregando(false);
      });

    return () => controller.abort();
  }, [ativo]);

  useEffect(() => {
    const cancelar = executar();
    return cancelar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { dados, carregando, erro, recarregar: executar };
}
