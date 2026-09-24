import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultSupportDueDate,
  formatSupportDate,
  mapSupportNotification,
  mapSupportTicket,
  normalizeSupportFormConfig,
} from '../lib/supportHelpers.js';

test('mapSupportTicket normaliza campos snake_case do backend', () => {
  assert.deepEqual(mapSupportTicket({
    id: 'link-1',
    scrumhub_ticket_id: 42,
    nome: 'Erro fiscal',
    status_id: 127,
    status_nome: 'Concluído',
    unread_count: 2,
    last_remote_update_at: '2026-09-21T10:00:00Z',
    concluido: 1,
  }), {
    id: 'link-1',
    scrumhubTicketId: 42,
    codigo: null,
    nome: 'Erro fiscal',
    prioridade: null,
    statusId: 127,
    statusNome: 'Concluído',
    concluido: true,
    aprovado: false,
    publicUrl: null,
    updatedAt: '2026-09-21T10:00:00Z',
    unreadCount: 2,
  });
});

test('mapSupportNotification reconhece conclusão e comentário', () => {
  assert.equal(mapSupportNotification({ event_type: 'completed' }).eventType, 'completed');
  assert.equal(mapSupportNotification({ event_type: 'outro' }).eventType, 'comment');
});

test('normalizeSupportFormConfig respeita campos dinâmicos e mantém obrigatórios', () => {
  const result = normalizeSupportFormConfig({
    projeto: { empresa_nome: 'Projeto teste' },
    formulario: {
      mostrar_descricao: false,
      campos: { anexos: { visivel: true, obrigatorio: true } },
    },
  });
  assert.equal(result.projectName, 'Projeto teste');
  assert.equal(result.fields.nome.required, true);
  assert.equal(result.fields.descricao.visible, false);
  assert.equal(result.fields.anexos.required, true);
});

test('helpers de data são determinísticos', () => {
  assert.equal(defaultSupportDueDate(new Date('2026-09-23T12:00:00Z')), '2026-09-30');
  assert.equal(
    formatSupportDate('2026-09-23T11:30:00Z', true, new Date('2026-09-23T12:00:00Z').getTime()),
    'há 30 min',
  );
  assert.equal(formatSupportDate('inválida'), '');
});
