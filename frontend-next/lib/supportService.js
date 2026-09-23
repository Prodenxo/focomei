import { apiClient } from '@/lib/apiClient';
import { mapSupportNotification, mapSupportTicket } from '@/lib/supportHelpers';

const addFiles = (form, name, files = []) => {
  files.forEach((file) => form.append(name, file, file.name));
};

const commentForm = (comentario, imagem) => {
  const form = new FormData();
  form.append('comentario', comentario);
  if (imagem) form.append('imagem', imagem, imagem.name);
  return form;
};

export const fetchSupportTicketFormConfig = () => apiClient.get('/support/ticket-form');

export async function listSupportTickets() {
  const result = await apiClient.get('/support/tickets');
  return {
    tickets: (result.tickets || []).map(mapSupportTicket),
    unreadCount: Number(result.unreadCount || 0),
  };
}

export const importSupportTickets = () => apiClient.post('/support/tickets/import', {});

export async function getSupportUnreadCount() {
  const result = await apiClient.get('/support/tickets/unread-count');
  return Number(result.unreadCount || 0);
}

export async function listSupportNotifications(limit = 20) {
  const result = await apiClient.get(`/support/tickets/notifications?limit=${encodeURIComponent(limit)}`);
  return {
    notifications: (result.notifications || []).map(mapSupportNotification),
    unreadCount: Number(result.unreadCount || 0),
  };
}

export const markAllSupportNotificationsRead = () =>
  apiClient.post('/support/tickets/notifications/read-all', {});

export const markSupportNotificationRead = (eventId) =>
  apiClient.post(`/support/tickets/notifications/${encodeURIComponent(eventId)}/read`, {});

export function createSupportTicket(input) {
  const form = new FormData();
  ['nome', 'descricao', 'prioridade', 'prazo'].forEach((key) => {
    if (input[key] != null && String(input[key]).trim()) form.append(key, String(input[key]).trim());
  });
  addFiles(form, 'anexos', input.anexos);
  return apiClient.postForm('/support/tickets', form, { timeoutMs: 120000 });
}

export const getSupportTicketDetail = (ticketId) =>
  apiClient.get(`/support/tickets/${encodeURIComponent(ticketId)}`);

export const getSupportTicketTimeline = (ticketId) =>
  apiClient.get(`/support/tickets/${encodeURIComponent(ticketId)}/timeline`);

export function commentSupportTicket(ticketId, comentario, imagem) {
  if (imagem) {
    return apiClient.postForm(
      `/support/tickets/${encodeURIComponent(ticketId)}/comments`,
      commentForm(comentario, imagem),
    );
  }
  return apiClient.post(`/support/tickets/${encodeURIComponent(ticketId)}/comments`, { comentario });
}

export const markSupportTicketRead = (ticketId) =>
  apiClient.post(`/support/tickets/${encodeURIComponent(ticketId)}/read`, {});

export async function listAdminSupportTickets() {
  const result = await apiClient.get('/support/admin/tickets');
  return (result.tickets || []).map((row) => ({
    ...mapSupportTicket(row),
    solicitanteNome: row.solicitanteNome ?? null,
    solicitanteEmail: row.solicitanteEmail ?? null,
    vinculadoAoApp: Boolean(row.vinculadoAoApp),
    ownerUnreadCount: Number(row.ownerUnreadCount || 0),
  }));
}

export const getAdminSupportTicketDetail = (ticketId) =>
  apiClient.get(`/support/admin/tickets/${encodeURIComponent(ticketId)}`);

export function replyAdminSupportTicket(ticketId, comentario, imagem) {
  if (imagem) {
    return apiClient.postForm(
      `/support/admin/tickets/${encodeURIComponent(ticketId)}/comments`,
      commentForm(comentario, imagem),
    );
  }
  return apiClient.post(`/support/admin/tickets/${encodeURIComponent(ticketId)}/comments`, { comentario });
}
