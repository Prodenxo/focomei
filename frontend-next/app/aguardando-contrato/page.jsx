'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clipboard, ExternalLink, FileSignature, LogOut, RefreshCcw } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useAuth } from '@/context/AuthProvider';
import { refreshMeiContractSignature } from '@/lib/billingApi';
import { fetchMeiBillingGateStatus } from '@/lib/meiBillingGate';
import {
  clearMeiContractPendingSession,
  readMeiContractPendingSession,
} from '@/lib/meiContractPendingSession';
import { APP_HOME_HREF } from '@/lib/appRoutes';

export default function AguardandoContratoPage() {
  const router = useRouter();
  const {
    booting,
    isAuthenticated,
    userId,
    role,
    mei,
    email,
    signOut,
    refreshSession,
  } = useAuth();
  const [signingUrl, setSigningUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    try {
      const status = await fetchMeiBillingGateStatus(role, mei, userId);
      if (status?.phase === 'ok') {
        clearMeiContractPendingSession(userId);
        await refreshSession();
        router.replace(APP_HOME_HREF);
        return;
      }
      if (status?.phase === 'planos') {
        router.replace('/planos');
        return;
      }

      const data = await refreshMeiContractSignature();
      if (data?.activated) {
        clearMeiContractPendingSession(userId);
        await refreshSession();
        router.replace(APP_HOME_HREF);
        return;
      }
      const pending = readMeiContractPendingSession(userId);
      const stored = window.sessionStorage.getItem('focomei_contract_signing_url') || '';
      const nextUrl = data?.signingUrl || status?.contract?.signingUrl
        || pending?.signingUrl || stored;
      if (nextUrl) {
        setSigningUrl(nextUrl);
        window.sessionStorage.setItem('focomei_contract_signing_url', nextUrl);
      }
      setMessage(data?.reason === 'missing_contrato_id'
        ? 'O contrato ainda está sendo preparado. Tente novamente em instantes.'
        : '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível consultar o contrato.');
    } finally {
      setLoading(false);
    }
  }, [mei, refreshSession, role, router, userId]);

  useEffect(() => {
    if (booting) return undefined;
    if (!isAuthenticated) {
      router.replace('/login');
      return undefined;
    }
    void refresh();
    const id = window.setInterval(refresh, signingUrl ? 15000 : 5000);
    return () => window.clearInterval(id);
  }, [booting, isAuthenticated, refresh, router, signingUrl]);

  return (
    <main className="min-h-screen bg-[var(--canvas)] px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-[20px] border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--shadow-card)]">
        <header className="bg-[var(--sidebar-bg)] p-6 text-white sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <BrandLogo />
            <button
              type="button"
              onClick={() => void signOut().then(() => router.replace('/login'))}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-sm"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sair
            </button>
          </div>
          <h1 className="mt-8 text-3xl font-bold">Assine o contrato</h1>
          <p className="mt-2 max-w-lg text-sm text-white/75">
            Sua conta será liberada automaticamente após a assinatura pelo responsável da empresa.
          </p>
          {email ? <p className="mt-3 text-xs text-white/60">Logado como {email}</p> : null}
        </header>

        <div className="p-6 sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <FileSignature className="h-7 w-7" aria-hidden />
          </div>
          <h2 className="mt-4 text-center text-xl font-semibold text-[var(--text-primary)]">
            Verifique seu WhatsApp
          </h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-[var(--text-muted)]">
            O link de assinatura digital também é enviado ao telefone cadastrado.
          </p>

          <div className="mt-6 break-all rounded-xl border border-[var(--card-border)] bg-[var(--canvas)] p-4 text-sm text-[var(--text-muted)]">
            {signingUrl || (loading ? 'Buscando o link…' : 'O link ainda está sendo preparado.')}
          </div>

          {message ? <p role="status" className="mt-3 text-center text-sm text-amber-700">{message}</p> : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              disabled={!signingUrl}
              onClick={() => window.open(signingUrl, '_blank', 'noopener,noreferrer')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Abrir
            </button>
            <button
              type="button"
              disabled={!signingUrl}
              onClick={() => void navigator.clipboard.writeText(signingUrl)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--card-border)] px-4 text-sm font-semibold disabled:opacity-50"
            >
              <Clipboard className="h-4 w-4" aria-hidden />
              Copiar
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--card-border)] px-4 text-sm font-semibold"
            >
              {loading ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <RefreshCcw className="h-4 w-4" aria-hidden />}
              Verificar
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
