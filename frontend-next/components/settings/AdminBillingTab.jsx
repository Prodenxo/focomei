'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  FileSignature,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { AppSelect } from '@/components/ui/AppSelect';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  cancelMeiSubscriptionLine,
  confirmPixMeiPayment,
  createMeiStripeCheckout,
  emitStripeMeiContrato,
  getContratoSignatario,
  listMeiPaymentApprovals,
  listOnetyCrmFunis,
  listStripeMeiSubscriptionLines,
  reconcileStripeMeiPayment,
  syncMaxMeiFromStripeLines,
} from '@/lib/adminBillingApi';
import { isValidCpf, normalizeCpf } from '@/lib/adminManagementHelpers';
import { updateUser } from '@/lib/userManagement';
import { MEI_PUBLIC_PACKAGES } from '@/lib/meiBillingPricing';
import { neutralizeProviderNames } from '@/lib/providerNeutralText';

const money = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = (value) =>
  value ? new Date(value).toLocaleString('pt-BR') : '—';
const errorMessage = (error, fallback) =>
  neutralizeProviderNames(error instanceof Error ? error.message : fallback);

function StatusBadge({ children, tone = 'muted' }) {
  const colors = {
    success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
    danger: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
    muted: 'bg-[var(--canvas)] text-[var(--text-muted)]',
  };
  return <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${colors[tone]}`}>{children}</span>;
}

export function AdminBillingTab({ empresas, initialEmpresaId, stripeReturn, onFeedback, onEmpresasChanged }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState({
    status: 'active',
    paymentChannel: '',
    contratoStatus: '',
    accessReleased: '',
    search: '',
  });
  const [loading, setLoading] = useState(false);
  const [funis, setFunis] = useState([]);
  const [funilId, setFunilId] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [billingEmpresa, setBillingEmpresa] = useState(null);
  const [emitting, setEmitting] = useState(null);
  const reconciledReturn = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listMeiPaymentApprovals(filters);
      setItems(result?.items || []);
      setSummary(result?.summary || null);
    } catch (error) {
      onFeedback({ type: 'error', text: errorMessage(error, 'Falha ao carregar cobranças.') });
    } finally {
      setLoading(false);
    }
  }, [filters, onFeedback]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    listOnetyCrmFunis()
      .then((result) => {
        if (!active) return;
        const ready = (result?.funis || []).filter((funil) => funil.ready);
        setFunis(ready);
        if (ready.length === 1) setFunilId(String(ready[0].id));
      })
      .catch((error) => {
        if (active) onFeedback({ type: 'error', text: errorMessage(error, 'Falha ao carregar funis comerciais.') });
      });
    return () => { active = false; };
  }, [onFeedback]);

  useEffect(() => {
    if (!stripeReturn || reconciledReturn.current) return;
    reconciledReturn.current = true;
    if (stripeReturn.status === 'cancel') {
      onFeedback({ type: 'error', text: 'O pagamento foi cancelado; nenhuma cobrança foi confirmada.' });
      return;
    }
    if (!stripeReturn.checkoutSessionId) {
      onFeedback({ type: 'error', text: 'O serviço de pagamento não devolveu o identificador da sessão.' });
      return;
    }
    setLoading(true);
    reconcileStripeMeiPayment({ checkoutSessionId: stripeReturn.checkoutSessionId, emitContrato: true })
      .then(() => {
        onFeedback({ type: 'success', text: 'Pagamento reconciliado e acesso atualizado.' });
        return Promise.all([load(), onEmpresasChanged()]);
      })
      .catch((error) => onFeedback({
        type: 'error',
        text: errorMessage(error, 'Falha ao reconciliar o pagamento.'),
      }))
      .finally(() => setLoading(false));
  }, [load, onEmpresasChanged, onFeedback, stripeReturn]);

  const empresaOptions = useMemo(
    () => (empresas || []).map((empresa) => ({
      value: empresa.id,
      label: empresa.nome_fantasia || empresa.empresa,
    })),
    [empresas],
  );
  const funilOptions = funis.map((funil) => ({ value: String(funil.id), label: funil.name }));

  const openEmpresa = (id) => {
    const empresa = empresas.find((item) => item.id === id);
    if (empresa) setBillingEmpresa(empresa);
  };

  useEffect(() => {
    if (!initialEmpresaId) return;
    setEmpresaId(initialEmpresaId);
    setBillingEmpresa(empresas.find((item) => item.id === initialEmpresaId) || null);
  }, [initialEmpresaId, empresas]);

  const handleContrato = async (item) => {
    if (!funilId) {
      onFeedback({ type: 'error', text: 'Selecione um funil comercial antes de emitir o contrato.' });
      return;
    }
    setEmitting(item.lineId);
    try {
      await emitStripeMeiContrato({
        empresaId: item.empresaId,
        funilId: Number(funilId),
        valor: Number(item.valueNumeric) || undefined,
      });
      onFeedback({ type: 'success', text: `Contrato enviado para ${item.empresaName}.` });
      await load();
    } catch (error) {
      onFeedback({ type: 'error', text: errorMessage(error, 'Falha ao emitir contrato.') });
      openEmpresa(item.empresaId);
    } finally {
      setEmitting(null);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Ativos', summary?.total],
          ['PIX', summary?.pix],
          ['Cartão', summary?.card],
          ['Acesso OK', summary?.accessReleased],
          ['Contratos OK', summary?.contratoSent],
          ['Falhas', summary?.contratoFailed],
        ].map(([label, value]) => (
          <Card key={label} className="p-3">
            <p className="text-xs text-[var(--text-muted)]">{label}</p>
            <p className="text-xl font-bold">{value ?? '—'}</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <AppSelect label="Empresa para cobrança" value={empresaId} onChange={setEmpresaId} options={empresaOptions} placeholder="Selecione a empresa" />
          <AppSelect label="Funil comercial" value={funilId} onChange={setFunilId} options={funilOptions} placeholder="Selecione o funil" emptyHint="Nenhum funil disponível" />
        </div>
        <button type="button" disabled={!empresaId} onClick={() => openEmpresa(empresaId)} className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50">
          <CreditCard className="h-4 w-4" /> Abrir cobrança da empresa
        </button>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="grid gap-2 md:grid-cols-5">
          <label className="flex h-10 items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 md:col-span-2">
            <Search className="h-4 w-4 text-[var(--text-muted)]" />
            <input aria-label="Buscar cobranças" value={filters.search} onChange={(event) => setFilters((old) => ({ ...old, search: event.target.value }))} placeholder="Empresa, CNPJ, admin ou e-mail" className="w-full bg-transparent text-sm outline-none" />
          </label>
          <AppSelect ariaLabel="Canal de pagamento" compact value={filters.paymentChannel} onChange={(value) => setFilters((old) => ({ ...old, paymentChannel: value }))} options={[{ value: '', label: 'Todos pagamentos' }, { value: 'pix', label: 'PIX' }, { value: 'card', label: 'Cartão' }]} />
          <AppSelect ariaLabel="Status do contrato" compact value={filters.contratoStatus} onChange={(value) => setFilters((old) => ({ ...old, contratoStatus: value }))} options={[{ value: '', label: 'Todos contratos' }, { value: 'pending', label: 'Pendente' }, { value: 'sent', label: 'Enviado' }, { value: 'failed', label: 'Falhou' }, { value: 'skipped', label: 'Não solicitado' }]} />
          <AppSelect ariaLabel="Liberação de acesso" compact value={filters.accessReleased} onChange={(value) => setFilters((old) => ({ ...old, accessReleased: value }))} options={[{ value: '', label: 'Todos acessos' }, { value: 'yes', label: 'Liberado' }, { value: 'no', label: 'Não liberado' }]} />
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--accent)]">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </Card>

      <div className="space-y-3" aria-live="polite">
        {loading && items.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Carregando aprovações…</p> : null}
        {!loading && items.length === 0 ? <Card className="p-5 text-sm text-[var(--text-muted)]">Nenhuma aprovação encontrada.</Card> : null}
        {items.map((item) => (
          <Card key={item.lineId} className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="font-semibold">{item.empresaName}</p>
                <p className="break-words text-xs text-[var(--text-muted)]">{item.ownerDisplayName || item.ownerEmail || 'Admin não identificado'} · {item.meiSlots} vagas · {money(item.valueNumeric)}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Aprovado em {dateTime(item.approvedAt || item.createdAt)} · {item.releasedByLabel}</p>
                {item.contratoError ? <p className="mt-2 text-xs text-red-600">{item.contratoError}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={item.paymentChannel === 'pix' ? 'success' : 'muted'}>{item.paymentChannelLabel}</StatusBadge>
                <StatusBadge tone={item.accessReleased ? 'success' : 'danger'}>{item.accessReleased ? 'Acesso liberado' : 'Sem acesso'}</StatusBadge>
                <StatusBadge tone={item.contratoStatus === 'sent' ? 'success' : item.contratoStatus === 'failed' ? 'danger' : 'warning'}>{item.contratoStatusLabel}</StatusBadge>
                <button type="button" onClick={() => openEmpresa(item.empresaId)} className="rounded-[10px] border border-[var(--card-border)] px-3 py-2 text-xs font-semibold">Cobrança</button>
                <button type="button" disabled={emitting === item.lineId} onClick={() => void handleContrato(item)} className="inline-flex items-center gap-1 rounded-[10px] bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                  {emitting === item.lineId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSignature className="h-3.5 w-3.5" />}
                  {item.contratoStatus === 'sent' ? 'Reemitir contrato' : 'Emitir contrato'}
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <EmpresaBillingModal
        empresa={billingEmpresa}
        funis={funis}
        initialFunilId={funilId}
        onClose={() => setBillingEmpresa(null)}
        onFeedback={onFeedback}
        onChanged={async () => {
          await Promise.all([load(), onEmpresasChanged()]);
        }}
      />
    </div>
  );
}

function EmpresaBillingModal({ empresa, funis, initialFunilId, onClose, onFeedback, onChanged }) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState('5');
  const [timing, setTiming] = useState('checkout');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [funilId, setFunilId] = useState(initialFunilId || '');
  const [signatario, setSignatario] = useState(null);
  const [cpf, setCpf] = useState('');
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    if (!empresa?.id) return;
    setLoading(true);
    try {
      const [lineResult, signatarioResult] = await Promise.all([
        listStripeMeiSubscriptionLines(empresa.id),
        getContratoSignatario(empresa.id).catch(() => null),
      ]);
      const nextLines = lineResult?.lines || [];
      setLines(nextLines);
      setSignatario(signatarioResult?.signatario || null);
      setTiming(nextLines.some((line) => line.status === 'active' && line.stripe_subscription_id) ? 'next_cycle' : 'checkout');
    } catch (error) {
      onFeedback({ type: 'error', text: errorMessage(error, 'Falha ao carregar cobrança.') });
    } finally {
      setLoading(false);
    }
  }, [empresa?.id, onFeedback]);

  useEffect(() => {
    if (!empresa) return;
    setCheckoutUrl('');
    setCpf('');
    setFunilId(initialFunilId || '');
    void load();
  }, [empresa, initialFunilId, load]);

  if (!empresa) return null;

  const run = async (action, success) => {
    setLoading(true);
    try {
      await action();
      onFeedback({ type: 'success', text: success });
      await load();
      await onChanged();
    } catch (error) {
      onFeedback({ type: 'error', text: errorMessage(error, 'Não foi possível concluir a cobrança.') });
    } finally {
      setLoading(false);
    }
  };

  const emitContract = () => {
    if (!funilId) {
      onFeedback({ type: 'error', text: 'Selecione um funil comercial.' });
      return;
    }
    void run(
      () => emitStripeMeiContrato({ empresaId: empresa.id, funilId: Number(funilId) }),
      'Contrato enviado para assinatura.',
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="billing-title">
        <div className="flex max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[18px] border border-[var(--card-border)] bg-[var(--card-bg)] shadow-xl sm:max-h-[90vh] sm:rounded-[18px]">
          <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--card-border)] bg-[var(--card-bg)] p-4">
            <div>
              <h2 id="billing-title" className="break-words font-semibold">Cobrança MEI — {empresa.nome_fantasia || empresa.empresa}</h2>
              <p className="text-xs text-[var(--text-muted)]">Cobranças, PIX, contratos e limite da empresa</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar cobrança" className="rounded-full p-2 hover:bg-[var(--canvas)]"><X className="h-4 w-4" /></button>
          </header>
          <div className="app-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            <section className="grid gap-3 sm:grid-cols-3">
              <AppSelect label="Pacote" value={slots} onChange={setSlots} options={MEI_PUBLIC_PACKAGES.map((pkg) => ({ value: String(pkg.meiSlots), label: `${pkg.label} — ${money(pkg.total)}/mês` }))} />
              <AppSelect label="Cobrança" value={timing} onChange={setTiming} options={[{ value: 'checkout', label: 'Link de pagamento' }, { value: 'next_cycle', label: 'Próxima fatura' }]} />
              <AppSelect label="Funil comercial" value={funilId} onChange={setFunilId} options={funis.map((funil) => ({ value: String(funil.id), label: funil.name }))} placeholder="Selecione" />
            </section>

            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={loading} onClick={() => void run(async () => {
                const result = await createMeiStripeCheckout({ empresaId: empresa.id, meiSlots: Number(slots), billingTiming: timing });
                setCheckoutUrl(result?.checkoutUrl || '');
              }, timing === 'checkout' ? 'Link de pagamento gerado.' : 'Pacote incluído na próxima fatura.')} className="rounded-[10px] bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Processar cobrança</button>
              <button type="button" disabled={loading} onClick={() => setConfirm({ kind: 'pix' })} className="rounded-[10px] border border-[var(--card-border)] px-3 py-2 text-xs font-semibold">Confirmar PIX</button>
              <button type="button" disabled={loading} onClick={() => void run(() => reconcileStripeMeiPayment({ empresaId: empresa.id, emitContrato: true }), 'Pagamento reconciliado.')} className="rounded-[10px] border border-[var(--card-border)] px-3 py-2 text-xs font-semibold">Reconciliar</button>
              <button type="button" disabled={loading} onClick={() => void run(() => syncMaxMeiFromStripeLines(empresa.id), 'Limite MEI alinhado.')} className="rounded-[10px] border border-[var(--card-border)] px-3 py-2 text-xs font-semibold">Alinhar limite</button>
              <button type="button" disabled={loading} onClick={emitContract} className="rounded-[10px] border border-[var(--card-border)] px-3 py-2 text-xs font-semibold">Emitir/reemitir contrato</button>
            </div>

            {checkoutUrl ? (
              <div className="rounded-[12px] border border-emerald-300 bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                <p className="break-all text-xs">{checkoutUrl}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void navigator.clipboard.writeText(checkoutUrl)} className="inline-flex items-center gap-1 text-xs font-semibold"><Copy className="h-3.5 w-3.5" /> Copiar</button>
                  <a href={checkoutUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold"><ExternalLink className="h-3.5 w-3.5" /> Abrir</a>
                </div>
              </div>
            ) : null}

            <section className="rounded-[12px] border border-[var(--card-border)] p-3">
              <h3 className="text-sm font-semibold">Signatário do contrato</h3>
              {signatario ? (
                <>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{signatario.displayName} · {signatario.email}</p>
                  <p className="mt-1 text-xs">{signatario.cpfCadastrado ? 'CPF cadastrado' : 'CPF pendente'}</p>
                  {!signatario.cpfCadastrado ? (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input aria-label="CPF do signatário" value={cpf} onChange={(event) => setCpf(event.target.value)} placeholder="CPF do signatário" inputMode="numeric" className="h-10 flex-1 rounded-[10px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm" />
                      <button type="button" disabled={!isValidCpf(cpf) || loading} onClick={() => void run(async () => {
                        await updateUser(signatario.userId, { cpf: normalizeCpf(cpf) });
                        setCpf('');
                      }, 'CPF do signatário salvo.')} className="rounded-[10px] bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Salvar CPF</button>
                    </div>
                  ) : null}
                </>
              ) : <p className="mt-1 text-xs text-[var(--text-muted)]">Nenhum admin signatário identificado.</p>}
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Linhas de assinatura</h3>
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" /> : null}
              </div>
              <div className="space-y-2">
                {lines.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Nenhum pacote encontrado.</p> : lines.map((line) => (
                  <div key={line.id} className="flex flex-col gap-2 rounded-[12px] border border-[var(--card-border)] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold">{line.mei_slots} vagas · {money(line.value_numeric)}</p>
                      <p className="text-xs text-[var(--text-muted)]">{line.billing_type} · {line.status} · {dateTime(line.created_at)}</p>
                    </div>
                    {line.status === 'active' && line.billing_type === 'pix_manual' ? (
                      <button type="button" aria-label={`Cancelar pacote de ${line.mei_slots} vagas`} onClick={() => setConfirm({ kind: 'cancel', line })} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"><Trash2 className="h-3.5 w-3.5" /> Cancelar linha</button>
                    ) : <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.kind === 'pix' ? 'Confirmar pagamento PIX?' : 'Cancelar pacote PIX?'}
        message={confirm?.kind === 'pix' ? `Liberar ${slots} vagas MEI para esta empresa?` : 'O limite MEI será recalculado.'}
        confirmLabel={confirm?.kind === 'pix' ? 'Confirmar PIX' : 'Cancelar pacote'}
        destructive={confirm?.kind === 'cancel'}
        loading={loading}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const current = confirm;
          setConfirm(null);
          if (current?.kind === 'pix') {
            const externalReference = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
            void run(() => confirmPixMeiPayment({ empresaId: empresa.id, meiSlots: Number(slots), emitContrato: true, externalReference }), 'PIX confirmado e acesso atualizado.');
          } else if (current?.line) {
            void run(() => cancelMeiSubscriptionLine({ empresaId: empresa.id, lineId: current.line.id }), 'Pacote cancelado.');
          }
        }}
      />
    </>
  );
}
