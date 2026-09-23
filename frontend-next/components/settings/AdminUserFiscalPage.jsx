'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { hasRole } from '@/lib/authRoles';
import { listUsers } from '@/lib/userManagement';
import {
  downloadAdminMeiGuide,
  downloadAdminParcelamentoPdf,
  fetchAdminMeiCertificateStatus,
  fetchAdminMeiPeriods,
  fetchAdminNotas,
  fetchAdminParcelamentos,
  sendAdminMeiGuideWhatsapp,
} from '@/lib/adminUserDataApi';
import { Card } from '@/components/ui/Card';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { formatCompetencia, formatDateBR } from '@/lib/fiscalFormat';

const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export function AdminUserFiscalPage({ userId }) {
  const { role } = useAuth();
  const canView = hasRole(role, ['admin']);
  const [user, setUser] = useState(null);
  const [certificate, setCertificate] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [parcelamentos, setParcelamentos] = useState([]);
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!canView || !userId) return;
    setLoading(true);
    setError('');
    try {
      const users = await listUsers();
      const selected = users.find((item) => item.id === userId) || null;
      setUser(selected);
      const status = await fetchAdminMeiCertificateStatus(userId);
      setCertificate(status);
      const cnpj = status?.documento || undefined;
      const [periodResult, installmentResult, noteResult] = await Promise.all([
        fetchAdminMeiPeriods(userId, cnpj),
        fetchAdminParcelamentos(userId, cnpj),
        fetchAdminNotas(userId),
      ]);
      setPeriods(periodResult);
      setParcelamentos(installmentResult?.parcelamentos || []);
      setNotas(noteResult);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar dados fiscais.');
    } finally {
      setLoading(false);
    }
  }, [canView, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const certificateLabel = useMemo(() => {
    if (certificate?.hasUserCertificate) return 'Certificado do cliente';
    if (certificate?.hasEnvCertificate) return 'Certificado do servidor';
    return 'Sem certificado';
  }, [certificate]);

  const run = async (key, action, success) => {
    setActing(key);
    setMessage('');
    try {
      await action();
      if (success) setMessage(success);
    } catch (actionError) {
      setMessage(actionError instanceof Error ? actionError.message : 'Falha ao concluir a ação.');
    } finally {
      setActing('');
    }
  };

  if (!canView) {
    return <EmptyPanel title="Acesso restrito" description="Somente administradores podem consultar dados fiscais de usuários." />;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 pb-8">
      <Link href="/minha-conta/usuarios?tab=users" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
        <ArrowLeft className="h-4 w-4" /> Voltar à gestão de usuários
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Área fiscal administrativa</h1>
          <p className="text-sm text-[var(--text-muted)]">{user?.displayName || user?.email || 'Usuário selecionado'}</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[var(--card-border)] px-3 text-sm font-semibold">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {message ? <div className="rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] p-3 text-sm" role="status">{message}</div> : null}
      {error ? <ErrorPanel message={error} onRetry={load} /> : null}
      {loading ? <div className="flex items-center gap-2 p-5 text-sm text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Carregando dados fiscais…</div> : null}

      {!loading && !error ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <ShieldCheck className="mb-2 h-5 w-5 text-[var(--accent)]" />
              <p className="text-xs text-[var(--text-muted)]">Certificado</p>
              <p className="font-semibold">{certificateLabel}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{certificate?.documento || 'CNPJ não informado'}</p>
            </Card>
            <Card className="p-4"><p className="text-xs text-[var(--text-muted)]">Guias MEI</p><p className="text-2xl font-bold">{periods.length}</p></Card>
            <Card className="p-4"><p className="text-xs text-[var(--text-muted)]">Notas fiscais</p><p className="text-2xl font-bold">{notas.length}</p></Card>
          </div>

          <Card className="p-4">
            <h2 className="mb-3 font-semibold">Guias MEI</h2>
            {periods.length === 0 ? <EmptyPanel title="Nenhuma guia disponível" /> : (
              <ul className="divide-y divide-[var(--card-border)]">
                {periods.map((period) => (
                  <li key={period.competencia} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="text-sm font-medium">{formatCompetencia(period.competencia)}</p><p className="text-xs text-[var(--text-muted)]">{period.status}</p></div>
                    <div className="flex gap-2">
                      <button type="button" disabled={Boolean(acting)} onClick={() => void run(`guide-${period.competencia}`, async () => {
                        const blob = await downloadAdminMeiGuide(userId, period.competencia, certificate?.documento);
                        saveBlob(blob, `guia-mei-${period.competencia}.pdf`);
                      })} className="inline-flex items-center gap-1 rounded-[10px] border px-3 py-2 text-xs font-semibold"><Download className="h-3.5 w-3.5" /> PDF</button>
                      <button type="button" disabled={Boolean(acting)} onClick={() => void run(`whatsapp-${period.competencia}`, () => sendAdminMeiGuideWhatsapp(userId, period.competencia, certificate?.documento), 'Guia enviada pelo WhatsApp.')} className="inline-flex items-center gap-1 rounded-[10px] border px-3 py-2 text-xs font-semibold"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 font-semibold">Parcelamentos</h2>
            {parcelamentos.length === 0 ? <EmptyPanel title="Nenhum parcelamento" /> : (
              <ul className="divide-y divide-[var(--card-border)]">
                {parcelamentos.map((item, index) => (
                  <li key={item.numero || index} className="flex items-center justify-between gap-3 py-3">
                    <div><p className="text-sm font-medium">Nº {item.numero || '—'} · {item.modalidade || 'Modalidade não informada'}</p><p className="text-xs text-[var(--text-muted)]">{item.situacao || 'Sem situação'} · {formatDateBR(item.dataPedido)}</p></div>
                    {item.numero ? <button type="button" disabled={Boolean(acting)} onClick={() => void run(`installment-${item.numero}`, async () => {
                      const blob = await downloadAdminParcelamentoPdf(userId, item.numero, { cnpj: certificate?.documento, modalidade: item.modalidade });
                      saveBlob(blob, `parcelamento-${item.numero}.pdf`);
                    })} className="inline-flex items-center gap-1 rounded-[10px] border px-3 py-2 text-xs font-semibold"><Download className="h-3.5 w-3.5" /> Baixar</button> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 font-semibold">Notas fiscais</h2>
            {notas.length === 0 ? <EmptyPanel title="Nenhuma nota fiscal" /> : (
              <ul className="divide-y divide-[var(--card-border)]">
                {notas.map((nota) => (
                  <li key={nota.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="text-sm font-medium">{nota.protocol || nota.id_integracao || nota.id}</p><p className="text-xs text-[var(--text-muted)]">{nota.document_type || 'NFSE'} · {nota.status || 'sem status'} · {formatDateBR(nota.created_at)}</p></div>
                    <div className="flex gap-2">
                      {nota.pdf_url ? <a href={nota.pdf_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-[10px] border px-3 py-2 text-xs font-semibold"><FileText className="h-3.5 w-3.5" /> PDF</a> : null}
                      {nota.xml_url ? <a href={nota.xml_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-[10px] border px-3 py-2 text-xs font-semibold">XML</a> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
