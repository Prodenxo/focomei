'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Eye, Loader2, X } from 'lucide-react';
import { listPendingAccessRequests, manageAccessRequest } from '@/lib/manageAccessRequests';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Cartao, CartaoCabecalho } from '@/components/ui/Cartao';
import { Botao } from '@/components/ui/Botao';

function requestLabel(request) {
  return request?.fullName || request?.email || 'Solicitante sem nome';
}

function companyLabel(request) {
  return request?.empresa?.nomeFantasia
    || request?.empresa?.razaoSocial
    || request?.empresa?.nome
    || 'Empresa não informada';
}

export function DashboardAccessRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRequests(await listPendingAccessRequests());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar solicitações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action, request) => {
    setActingId(request.userId);
    setError('');
    try {
      await manageAccessRequest(action, request.userId);
      setRequests((current) => current.filter((item) => item.userId !== request.userId));
      if (action === 'reject') setRejectTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao revisar solicitação.');
    } finally {
      setActingId(null);
    }
  };

  return (
    <>
      <Cartao aria-live="polite">
        <CartaoCabecalho
          titulo="Solicitações de acesso"
          icone="pessoas"
          acao={
            requests.length > 0 ? (
              <span className="rounded-full bg-[var(--verde)] px-2 py-0.5 text-xs font-bold text-white">
                {requests.length}
              </span>
            ) : null
          }
        />

        {loading ? (
          <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-[var(--tinta-3)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Carregando solicitações…
          </div>
        ) : error ? (
          <div className="space-y-3 rounded-[var(--r-md)] border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <p>{error}</p>
            <button type="button" className="font-semibold underline" onClick={() => void load()}>
              Tentar novamente
            </button>
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-[var(--r-md)] border border-[var(--linha-suave)] bg-[var(--caixa-funda)] p-4 text-sm text-[var(--tinta-3)]">
            Nenhuma solicitação pendente.
          </div>
        ) : (
          <ul className="space-y-3">
            {requests.map((request) => {
              const acting = actingId === request.userId;
              return (
                <li
                  key={request.userId}
                  className="rounded-[var(--r-md)] border border-[var(--linha-suave)] bg-[var(--caixa-funda)] p-3"
                >
                  <p className="truncate text-sm font-bold text-[var(--tinta)]">
                    {requestLabel(request)}
                  </p>
                  <p className="truncate text-xs text-[var(--tinta-3)]">{companyLabel(request)}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => setRejectTarget(request)}
                      className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-red-300 px-3 text-xs font-semibold text-red-700 disabled:opacity-60"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                      Rejeitar
                    </button>
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => void act('approve', request)}
                      className="inline-flex h-9 items-center gap-1 rounded-[10px] bg-[var(--verde)] px-3 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {acting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      )}
                      Aprovar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4">
          <Botao variante="secundario" como="a" href="/solicitacoes">
            Ver todas
            <Eye className="h-4 w-4" aria-hidden />
          </Botao>
        </div>
      </Cartao>

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="Rejeitar solicitação?"
        message={`Rejeitar e remover o cadastro de ${requestLabel(rejectTarget)}?`}
        confirmLabel="Rejeitar e excluir"
        onConfirm={() => void act('reject', rejectTarget)}
        onCancel={() => setRejectTarget(null)}
        loading={Boolean(rejectTarget && actingId === rejectTarget.userId)}
        destructive
      />
    </>
  );
}
