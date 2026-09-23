'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { fetchNumeracaoFiscal, updateNumeracaoFiscal } from '@/lib/fiscalApi';

const DOCUMENTOS = [
  { key: 'nfse', label: 'Último DPS/RPS emitido (NFS-e)' },
  { key: 'nfe', label: 'Último número emitido (NF-e)' },
];

export function NumeracaoFiscalPanel({ cnpj }) {
  const [data, setData] = useState(null);
  const [inputs, setInputs] = useState({ nfse: '', nfe: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    const digits = String(cnpj || '').replace(/\D/g, '');
    if (digits.length !== 14) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await fetchNumeracaoFiscal(digits);
      setData(result);
      setInputs({
        nfse: String(result?.nfse?.ultimoUtilizado ?? 0),
        nfe: String(result?.nfe?.ultimoUtilizado ?? 0),
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível consultar a numeração.',
      });
    } finally {
      setLoading(false);
    }
  }, [cnpj]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (documentType) => {
    const ultimoUtilizado = Number.parseInt(inputs[documentType], 10);
    if (!Number.isInteger(ultimoUtilizado) || ultimoUtilizado < 0) {
      setMessage({ type: 'error', text: 'Informe o último número emitido (0 ou maior).' });
      return;
    }

    const historicoMaximo = Number(data?.[documentType]?.historicoMaximo || 0);
    if (
      ultimoUtilizado < historicoMaximo
      && !window.confirm(
        `Já existe numeração até ${historicoMaximo} no histórico. Deseja usar ${ultimoUtilizado} mesmo assim?`,
      )
    ) {
      return;
    }

    setSaving(documentType);
    setMessage(null);
    try {
      const result = await updateNumeracaoFiscal({
        cnpj,
        documentType,
        ultimoUtilizado,
        serie: data?.[documentType]?.serie,
      });
      setData(result);
      setInputs((current) => ({
        ...current,
        [documentType]: String(result?.[documentType]?.ultimoUtilizado ?? ultimoUtilizado),
      }));
      setMessage({
        type: 'success',
        text: `Numeração salva. A próxima nota sairá com o número ${ultimoUtilizado + 1}.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error
          ? error.message
          : 'Não foi possível gravar a numeração informada.',
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="space-y-3 border-t border-[var(--card-border)] pt-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Numeração das notas</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Informe o número da última nota emitida. A próxima sai com o número seguinte,
          mesmo que o emissor tenha registrado uma numeração maior.
        </p>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Consultando numeração…
        </p>
      ) : (
        <div className="space-y-3">
          {DOCUMENTOS.map(({ key, label }) => {
            const entry = data?.[key];
            return (
              <div key={key} className="rounded-[12px] border border-[var(--card-border)] p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="flex flex-1 flex-col gap-1 text-xs">
                    <span className="font-medium text-[var(--text-muted)]">{label}</span>
                    <input
                      inputMode="numeric"
                      value={inputs[key]}
                      onChange={(event) => setInputs((current) => ({
                        ...current,
                        [key]: event.target.value.replace(/\D/g, ''),
                      }))}
                      className="h-10 rounded-[10px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void save(key)}
                    disabled={saving !== null}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-[var(--accent)] px-4 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {saving === key
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Save className="h-3.5 w-3.5" />}
                    Salvar
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                  A próxima nota sai com o número {Number(inputs[key] || 0) + 1}.
                  {entry?.historicoMaximo
                    ? ` Maior número já registrado no emissor: ${entry.historicoMaximo}.`
                    : ''}
                  {entry?.ajusteManualPendente ? ' Ajuste manual pendente.' : ''}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {message ? (
        <p className={`text-xs ${message.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
