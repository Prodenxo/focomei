'use client';

import { Loader2, Paperclip, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  defaultSupportDueDate,
  normalizeSupportFormConfig,
  SUPPORT_PRIORITIES,
} from '@/lib/supportHelpers';
import { createSupportTicket, fetchSupportTicketFormConfig } from '@/lib/supportService';

const ACCEPTED = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif';

export function SupportTicketForm({ onCreated, onCancel }) {
  const [config, setConfig] = useState(() => normalizeSupportFormConfig());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState({
    nome: '', descricao: '', prioridade: 'media', prazo: defaultSupportDueDate(),
  });
  const [files, setFiles] = useState([]);

  useEffect(() => {
    fetchSupportTicketFormConfig()
      .then((result) => setConfig(normalizeSupportFormConfig(result)))
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar o formulário.'))
      .finally(() => setLoading(false));
  }, []);

  const setValue = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }));

  const selectFiles = (event) => {
    const selected = [...event.target.files];
    const tooLarge = selected.find((file) => file.size > 50 * 1024 * 1024);
    if (tooLarge) {
      setError(`${tooLarge.name} excede o limite de 50 MB.`);
      return;
    }
    setFiles((current) => [...current, ...selected].slice(0, 10));
    event.target.value = '';
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!values.nome.trim()) return setError('Informe o assunto do chamado.');
    if (config.fields.prazo.visible && !/^\d{4}-\d{2}-\d{2}$/.test(values.prazo)) {
      return setError('Informe um prazo válido.');
    }
    setSubmitting(true);
    try {
      await createSupportTicket({ ...values, anexos: files });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o chamado.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" aria-label="Carregando formulário" /></div>;

  return (
    <form onSubmit={submit} className="space-y-4 p-4 sm:p-6">
      <div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Abrir chamado</h3>
        <p className="text-sm text-[var(--text-muted)]">{config.projectName} — conte como podemos ajudar.</p>
      </div>
      {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}
      <label className="block text-sm font-medium text-[var(--text-primary)]">
        Assunto *
        <input value={values.nome} onChange={setValue('nome')} maxLength={200} className="mt-1 h-11 w-full rounded-xl border border-[var(--card-border)] bg-[var(--canvas)] px-3" placeholder="Ex.: erro ao emitir nota fiscal" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {config.fields.prioridade.visible ? (
          <label className="block text-sm font-medium text-[var(--text-primary)]">
            Prioridade {config.fields.prioridade.required ? '*' : ''}
            <select value={values.prioridade} onChange={setValue('prioridade')} className="mt-1 h-11 w-full rounded-xl border border-[var(--card-border)] bg-[var(--canvas)] px-3">
              {SUPPORT_PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        ) : null}
        {config.fields.prazo.visible ? (
          <label className="block text-sm font-medium text-[var(--text-primary)]">
            Prazo {config.fields.prazo.required ? '*' : ''}
            <input type="date" value={values.prazo} onChange={setValue('prazo')} className="mt-1 h-11 w-full rounded-xl border border-[var(--card-border)] bg-[var(--canvas)] px-3" />
          </label>
        ) : null}
      </div>
      {config.fields.descricao.visible ? (
        <label className="block text-sm font-medium text-[var(--text-primary)]">
          Descrição {config.fields.descricao.required ? '*' : ''}
          <textarea required={config.fields.descricao.required} value={values.descricao} onChange={setValue('descricao')} maxLength={5000} rows={5} className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-[var(--canvas)] p-3" placeholder="Descreva o problema e os passos que levaram até ele." />
        </label>
      ) : null}
      {config.fields.anexos.visible ? (
        <div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent)]">
            <Paperclip className="h-4 w-4" aria-hidden /> Selecionar anexos
            <input type="file" multiple accept={ACCEPTED} onChange={selectFiles} className="sr-only" />
          </label>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Até 10 arquivos, 50 MB por arquivo.</p>
          <ul className="mt-2 space-y-1">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg bg-[var(--canvas)] px-3 py-2 text-sm">
                <span className="truncate text-[var(--text-primary)]">{file.name}</span>
                <button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remover ${file.name}`}><Trash2 className="h-4 w-4 text-red-600" /></button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex justify-end gap-2 border-t border-[var(--card-border)] pt-4">
        <button type="button" onClick={onCancel} className="h-10 rounded-xl border border-[var(--card-border)] px-4 text-sm font-semibold">Cancelar</button>
        <button type="submit" disabled={submitting} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-60">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Criar chamado
        </button>
      </div>
    </form>
  );
}
