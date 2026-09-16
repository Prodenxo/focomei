'use client';

import { useCallback, useEffect, useState } from 'react';
import { firstName, readSession } from '@/lib/session';
import { fetchSessaoApi } from '@/services/visaoGeral';
import { normalizeRoleValue } from '@/lib/meiAccess';
import { isAbortError } from '@/lib/api';

/**
 * Sessão vinda do navegador (gravada pelo app antigo), revalidada no backend para
 * pegar role e MEI atualizados — o snapshot local envelhece.
 */
export function useSessao() {
  const [sessao, setSessao] = useState(null);
  const [estado, setEstado] = useState('verificando');

  useEffect(() => {
    const local = readSession();
    if (!local) {
      setEstado('sem-sessao');
      return undefined;
    }

    setSessao(local);
    setEstado('pronta');

    const controller = new AbortController();
    fetchSessaoApi(controller.signal)
      .then((remota) => {
        setSessao((atual) => ({
          ...atual,
          role: normalizeRoleValue(remota.role) ?? atual.role,
          mei: typeof remota.mei === 'boolean' ? remota.mei : atual.mei,
          empresaId: remota.empresaId ?? atual.empresaId,
          displayName: remota.user?.displayName || atual.displayName,
          email: remota.user?.email || atual.email,
        }));
      })
      .catch((e) => {
        if (isAbortError(e)) return;
        /* backend fora do ar não derruba a tela: segue com o snapshot local */
      });

    return () => controller.abort();
  }, []);

  const encerrar = useCallback(() => {
    try {
      window.localStorage.removeItem('focomei-local-auth');
      window.localStorage.removeItem('financas-pessoais-auth');
    } catch {
      /* segue para o login mesmo sem conseguir limpar */
    }
  }, []);

  return {
    sessao,
    estado,
    primeiroNome: firstName(sessao),
    encerrar,
  };
}
