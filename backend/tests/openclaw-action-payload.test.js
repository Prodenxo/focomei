import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeOpenclawActionPayload,
  normalizeOpenclawNfsePayloadAliases,
  normalizeOpenclawCalendarCreatePayload,
} from '../src/utils/openclaw-action-payload.js';
import { parseValorReais, hasExplicitNfseServicoSelection } from '../src/services/openclaw-nfse.service.js';
import {
  resolveCreateCalendarTimesFromPayload,
} from '../src/services/calendar-events.service.js';
import { formatCalendarTimeLabel } from '../src/services/calendar-time-slots.js';

test('mergeOpenclawActionPayload — flat valor/confirm no topo (como o LLM mandou)', () => {
  const payload = mergeOpenclawActionPayload({
    action: 'emit_nfse',
    phone: '5521996185328',
    cliente_id: '7a8cf04f-9b75-4a98-a235-9ea73f1d315e',
    servico_codigo: '08.02.01',
    valor: '2',
    confirm: true,
  });
  assert.equal(payload.valor, '2');
  assert.equal(payload.confirm, true);
  assert.equal(payload.cliente_id, '7a8cf04f-9b75-4a98-a235-9ea73f1d315e');
  assert.equal(payload.servico_codigo, '08.02.01');
  assert.equal(payload.action, undefined);
  assert.equal(payload.phone, undefined);
});

test('mergeOpenclawActionPayload — nested payload ganha sobre flat', () => {
  const payload = mergeOpenclawActionPayload({
    action: 'emit_nfse',
    valor: '1',
    payload: { valor: 2, tomadorNome: 'Leo', confirm: true },
  });
  assert.equal(payload.valor, 2);
  assert.equal(payload.tomadorNome, 'Leo');
  assert.equal(payload.confirm, true);
});

test('normalizeOpenclawNfsePayloadAliases — cliente_id e servico_codigo', () => {
  const n = normalizeOpenclawNfsePayloadAliases({
    cliente_id: 'abc',
    servico_codigo: '08.02.01',
    valor_servico: '2,50',
  });
  assert.equal(n.catalogoClienteId, 'abc');
  assert.equal(n.codigoServico, '08.02.01');
  assert.equal(n.valor, '2,50');
});

test('parseValorReais aceita 2 e "2" (caso WhatsApp)', () => {
  assert.equal(parseValorReais(2), 2);
  assert.equal(parseValorReais('2'), 2);
  assert.equal(parseValorReais('2,00'), 2);
});

test('normalizeOpenclawCalendarCreatePayload — só início ganha 1 h de duração', () => {
  const n = normalizeOpenclawCalendarCreatePayload({
    title: 'Reunião com Roseni',
    time: '18:00',
  });
  assert.equal(n.durationMinutes, 60);
  assert.equal(n.endTime, undefined);
});

test('normalizeOpenclawCalendarCreatePayload — não altera quando já tem fim', () => {
  const n = normalizeOpenclawCalendarCreatePayload({
    time: '14:00',
    endTime: '15:00',
  });
  assert.equal(n.durationMinutes, undefined);
});

test('parseCalendarEventTimeHm aceita "18 horas" e "as 18h"', async () => {
  const { parseCalendarEventTimeHm } = await import('../src/services/calendar-events.service.js');
  assert.deepEqual(parseCalendarEventTimeHm('18 horas'), { hour: 18, minute: 0 });
  assert.deepEqual(parseCalendarEventTimeHm('as 18h'), { hour: 18, minute: 0 });
});

test('resolveCreateCalendarTimesFromPayload com durationMinutes 60', () => {
  const t = resolveCreateCalendarTimesFromPayload({
    time: '18:00',
    durationMinutes: 60,
  });
  assert.equal(formatCalendarTimeLabel(t.startHour, t.startMinute), '18:00');
  assert.equal(formatCalendarTimeLabel(t.endHour, t.endMinute), '19:00');
});
