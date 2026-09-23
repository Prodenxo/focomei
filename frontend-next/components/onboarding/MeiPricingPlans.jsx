'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { MEI_PUBLIC_PACKAGES } from '@/lib/meiBillingPricing';
import {
  confirmSelfServeMeiPlan,
  createSelfServeMeiCheckout,
} from '@/lib/billingApi';
import { fetchMeiBillingGateStatus } from '@/lib/meiBillingGate';
import { stashMeiContractPendingSession } from '@/lib/meiContractPendingSession';
import { LoadingPanel } from '@/components/ui/LoadingPanel';

const formatBrl = (n) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

export function MeiPricingPlans() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut, userId, email, role, mei } = useAuth();
  const [checking, setChecking] = useState(true);
  const [packages, setPackages] = useState(MEI_PUBLIC_PACKAGES);
  const [billingMode, setBillingMode] = useState('contract_first');
  const [loadingSlots, setLoadingSlots] = useState(null);
  const [message, setMessage] = useState('');

  const refreshGate = useCallback(async () => {
    setChecking(true);
    try {
      const status = await fetchMeiBillingGateStatus(role, mei, userId);
      if (!status) {
        router.replace('/');
        return;
      }
      if (status.packages?.length) setPackages(status.packages);
      setBillingMode(status.billingMode === 'stripe' ? 'stripe' : 'contract_first');
      if (status.phase === 'aguardando_contrato') {
        router.replace('/aguardando-contrato');
        return;
      }
      if (!status.required) {
        router.replace('/');
        return;
      }
    } catch {
      /* tabela local */
    } finally {
      setChecking(false);
    }
  }, [mei, role, router, userId]);

  useEffect(() => {
    void refreshGate();
  }, [refreshGate]);

  useEffect(() => {
    const stripe = searchParams.get('stripe_mei');
    if (stripe === 'success') {
      setMessage('Pagamento recebido! Liberando acesso…');
      const t = setTimeout(() => void refreshGate(), 1500);
      return () => clearTimeout(t);
    }
    if (stripe === 'cancel') {
      setMessage('Checkout cancelado.');
    }
    return undefined;
  }, [searchParams, refreshGate]);

  const handleSelect = async (pack) => {
    setLoadingSlots(pack.meiSlots);
    setMessage('');
    try {
      if (billingMode === 'stripe') {
        const data = await createSelfServeMeiCheckout(pack.meiSlots);
        if (!data?.checkoutUrl) throw new Error('O pagamento não retornou um link.');
        window.location.href = data.checkoutUrl;
        return;
      }

      const data = await confirmSelfServeMeiPlan(pack.meiSlots);
      if (data?.activated) {
        router.replace('/');
        return;
      }
      stashMeiContractPendingSession(userId, {
        lineId: data?.lineId,
        signingUrl: data?.signingUrl ?? null,
        contratoOnetyId: data?.contratoOnetyId ?? null,
      });
      router.replace('/aguardando-contrato');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Não foi possível gerar o contrato.');
    } finally {
      setLoadingSlots(null);
    }
  };

  if (checking) {
    return <LoadingPanel label="Carregando planos…" />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Planos MEI</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Escolha quantos CNPJs MEI sua empresa pode usar.
          </p>
          {email ? (
            <p className="mt-2 text-xs text-[var(--text-muted)]">{email}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="text-sm text-[var(--text-muted)] underline"
          onClick={() => void signOut().then(() => router.replace('/login'))}
        >
          Sair
        </button>
      </div>

      {message ? <p className="text-sm text-[var(--text-primary)]">{message}</p> : null}

      <p className="text-sm text-[var(--text-muted)]">
        {billingMode === 'contract_first'
          ? 'Escolha o plano e assine o contrato digital para liberar sua conta.'
          : 'Escolha um plano para continuar no pagamento seguro.'}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {packages.map((pack) => (
          <div
            key={pack.meiSlots}
            className={`rounded-2xl border p-5 ${
              pack.featured
                ? 'border-[var(--accent)] bg-[var(--card-bg)] shadow-md'
                : 'border-[var(--card-border)] bg-[var(--card-bg)]'
            }`}
          >
            {pack.badge ? (
              <span className="text-xs font-bold uppercase text-[var(--accent)]">{pack.badge}</span>
            ) : null}
            <p className="mt-1 text-lg font-bold">{pack.label}</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{formatBrl(pack.total)}/mês</p>
            <p className="text-xs text-[var(--text-muted)]">
              {formatBrl(pack.unit)} por CNPJ
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-[var(--accent)] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              disabled={loadingSlots === pack.meiSlots}
              onClick={() => void handleSelect(pack)}
            >
              {loadingSlots === pack.meiSlots ? 'Abrindo…' : 'Assinar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
