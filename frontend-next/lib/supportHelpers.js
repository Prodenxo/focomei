const first = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

export const SUPPORT_PRIORITIES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

export function mapSupportTicket(row = {}) {
  return {
    id: String(first(row.id, row.scrumhub_ticket_id, row.scrumhubTicketId, '')),
    scrumhubTicketId: Number(first(row.scrumhub_ticket_id, row.scrumhubTicketId)),
    codigo: row.codigo ?? null,
    nome: String(first(row.nome, 'Chamado')),
    prioridade: row.prioridade ?? null,
    statusId: Number(first(row.status_id, row.statusId)) || null,
    statusNome: first(row.status_nome, row.statusNome) ?? null,
    concluido: Boolean(row.concluido),
    aprovado: Boolean(row.aprovado),
    publicUrl: first(row.public_url, row.publicUrl) ?? null,
    updatedAt: first(row.last_remote_update_at, row.updated_at, row.updatedAt) ?? null,
    unreadCount: Number(first(row.unread_count, row.unreadCount, 0)),
  };
}

export function mapSupportNotification(row = {}) {
  return {
    id: String(row.id || ''),
    eventType: row.event_type === 'completed' ? 'completed' : 'comment',
    title: String(row.title || 'Atualização no chamado'),
    message: String(row.message || ''),
    readAt: row.read_at ?? null,
    createdAt: String(row.created_at || ''),
    scrumhubTicketId: Number(row.scrumhub_ticket_id),
    codigo: row.codigo ?? null,
  };
}

export function normalizeSupportFormConfig(config = {}) {
  const form = config.formulario && typeof config.formulario === 'object'
    ? config.formulario
    : {};
  const enabled = (key, fallback = true) => {
    const value = first(form[key], form[`mostrar_${key}`], form.campos?.[key]?.visivel);
    return value === undefined ? fallback : ![false, 0, '0', 'false'].includes(value);
  };
  const required = (key, fallback = false) => {
    const value = first(form[`${key}_obrigatorio`], form.campos?.[key]?.obrigatorio);
    return value === undefined ? fallback : [true, 1, '1', 'true'].includes(value);
  };
  return {
    projectName: config.projeto?.nome || config.projeto?.empresa_nome || 'Foco MEI',
    fields: {
      nome: { visible: true, required: true },
      prioridade: { visible: enabled('prioridade'), required: required('prioridade', true) },
      prazo: { visible: enabled('prazo'), required: required('prazo', true) },
      descricao: { visible: enabled('descricao'), required: required('descricao') },
      anexos: { visible: enabled('anexos'), required: required('anexos') },
    },
  };
}

export function defaultSupportDueDate(now = new Date(), days = 7) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatSupportDate(value, relative = false, now = Date.now()) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (!relative) return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const minutes = Math.max(0, Math.round((now - date.getTime()) / 60000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return days < 30 ? `há ${days} d` : date.toLocaleDateString('pt-BR');
}
