'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import {
  fetchCatalogoCodigosServicos,
  importCnaesProdutos,
  sugerirCatalogoCodigosServicos,
} from '@/lib/fiscalApi';
import { buildCnaeImportPayload } from '@/lib/fiscalPhase4';

export function CnaeImportDialog({ cnaes, onClose, onImported }) {
  const [step, setStep] = useState('cnaes');
  const [selected, setSelected] = useState(() => new Set(cnaes.map((item) => item.codigo)));
  const [suggestions, setSuggestions] = useState({});
  const [serviceByCnae, setServiceByCnae] = useState({});
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [browseCnae, setBrowseCnae] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const picked = useMemo(
    () => cnaes.filter((item) => selected.has(item.codigo)),
    [cnaes, selected],
  );

  useEffect(() => {
    if (step !== 'servicos' || picked.length === 0) return;
    let active = true;
    setSuggestionsLoading(true);
    Promise.all(picked.map(async (item) => {
      try {
        const rows = await sugerirCatalogoCodigosServicos({
          q: item.descricao || item.codigo,
          limit: 6,
        });
        return [item.codigo, Array.isArray(rows) ? rows : []];
      } catch {
        return [item.codigo, []];
      }
    })).then((entries) => {
      if (active) setSuggestions(Object.fromEntries(entries));
    }).finally(() => {
      if (active) setSuggestionsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [step, picked]);

  useEffect(() => {
    if (!browseCnae) return;
    let active = true;
    const timer = setTimeout(() => {
      setBrowseLoading(true);
      fetchCatalogoCodigosServicos({ q: query.trim(), limit: 40 })
        .then((rows) => {
          if (active) setResults(Array.isArray(rows) ? rows : []);
        })
        .catch(() => {
          if (active) setResults([]);
        })
        .finally(() => {
          if (active) setBrowseLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [browseCnae, query]);

  const toggle = (codigo) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  };

  const chooseService = (cnae, service) => {
    setServiceByCnae((current) => ({ ...current, [cnae]: service }));
  };

  const handleImport = async () => {
    const payload = buildCnaeImportPayload(cnaes, selected, serviceByCnae);
    if (payload.items.length === 0) {
      setError('Selecione ao menos um CNAE.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await importCnaesProdutos(payload);
      onImported?.(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao importar CNAEs.');
    } finally {
      setSaving(false);
    }
  };

  const renderService = (cnae, service, prefix) => {
    const checked = serviceByCnae[cnae]?.codigo === service.codigo;
    return (
      <button
        key={`${prefix}-${cnae}-${service.codigo}`}
        type="button"
        role="radio"
        aria-checked={checked}
        onClick={() => chooseService(cnae, service)}
        className={`w-full rounded-[10px] border px-3 py-2 text-left text-xs ${
          checked
            ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
            : 'border-[var(--card-border)] hover:bg-[var(--canvas)]'
        }`}
      >
        <span className="font-semibold text-[var(--text-primary)]">{service.codigo}</span>
        {service.descricao ? (
          <span className="ml-2 text-[var(--text-muted)]">{service.descricao}</span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="cnae-import-title">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[20px] border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between border-b border-[var(--card-border)] px-5 py-4">
          <div>
            <h2 id="cnae-import-title" className="text-lg font-semibold text-[var(--text-primary)]">
              {step === 'cnaes' ? 'Escolher CNAEs' : 'Vincular código LC 116'}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {step === 'cnaes'
                ? 'Selecione as atividades que deseja levar ao catálogo.'
                : 'Escolha uma sugestão, pesquise a lista oficial ou complete depois.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-2 text-[var(--text-muted)] hover:bg-[var(--canvas)]">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {step === 'cnaes' ? cnaes.map((item) => (
            <label key={item.codigo} className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-[var(--card-border)] p-3 hover:bg-[var(--canvas)]">
              <input
                type="checkbox"
                checked={selected.has(item.codigo)}
                onChange={() => toggle(item.codigo)}
                className="mt-0.5 h-4 w-4 rounded border-[var(--card-border)] text-[var(--accent)]"
              />
              <span>
                <span className="block text-sm font-semibold text-[var(--text-primary)]">
                  {item.codigo}{item.principal ? ' · principal' : ''}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{item.descricao || 'Sem descrição'}</span>
              </span>
            </label>
          )) : (
            <>
              {suggestionsLoading ? (
                <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Buscando sugestões…
                </p>
              ) : null}
              {picked.map((item) => (
                <section key={item.codigo} className="space-y-2 rounded-[14px] border border-[var(--card-border)] p-4">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    CNAE {item.codigo}{item.principal ? ' · principal' : ''}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">{item.descricao}</p>
                  {serviceByCnae[item.codigo] ? (
                    <p className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      LC 116 {serviceByCnae[item.codigo].codigo} selecionado
                    </p>
                  ) : null}
                  <div role="radiogroup" aria-label={`Códigos sugeridos para o CNAE ${item.codigo}`} className="space-y-2">
                    {(suggestions[item.codigo] || []).map((service) => renderService(item.codigo, service, 'suggestion'))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBrowseCnae(browseCnae === item.codigo ? null : item.codigo);
                      setQuery('');
                      setResults([]);
                    }}
                    className="text-xs font-semibold text-[var(--accent)] hover:underline"
                  >
                    {browseCnae === item.codigo ? 'Fechar busca' : 'Buscar na lista LC 116'}
                  </button>
                  {browseCnae === item.codigo ? (
                    <div className="space-y-2">
                      <label className="flex h-10 items-center gap-2 rounded-[10px] border border-[var(--card-border)] px-3">
                        <Search className="h-4 w-4 text-[var(--text-muted)]" aria-hidden />
                        <span className="sr-only">Buscar código ou descrição</span>
                        <input
                          type="search"
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Código ou descrição"
                          className="w-full bg-transparent text-sm text-[var(--text-primary)] focus:outline-none"
                        />
                      </label>
                      {browseLoading ? <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" aria-label="Carregando códigos" /> : null}
                      {results.map((service) => renderService(item.codigo, service, 'browse'))}
                      {!browseLoading && results.length === 0 ? (
                        <p className="text-xs text-[var(--text-muted)]">Nenhum código encontrado.</p>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              ))}
            </>
          )}

          {error ? <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--card-border)] px-5 py-4">
          <button
            type="button"
            onClick={step === 'cnaes' ? onClose : () => setStep('cnaes')}
            className="h-10 rounded-[12px] border border-[var(--card-border)] px-4 text-sm font-semibold text-[var(--text-primary)]"
          >
            {step === 'cnaes' ? 'Cancelar' : 'Voltar'}
          </button>
          <button
            type="button"
            onClick={step === 'cnaes'
              ? () => {
                if (picked.length === 0) setError('Selecione ao menos um CNAE.');
                else {
                  setError(null);
                  setStep('servicos');
                }
              }
              : handleImport}
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {step === 'cnaes' ? 'Continuar' : 'Importar selecionados'}
          </button>
        </div>
      </div>
    </div>
  );
}
