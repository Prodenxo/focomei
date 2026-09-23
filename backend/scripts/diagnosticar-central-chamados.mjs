/**
 * Diagnóstico da central de chamados: mostra configuração, payload bruto da timeline
 * do ScrumHub e executa um ciclo de sincronização + envio de WhatsApp.
 *
 * Uso (dentro do container do backend):
 *   node scripts/diagnosticar-central-chamados.mjs
 *   node scripts/diagnosticar-central-chamados.mjs --ticket 7707
 */
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const { env } = await import('../src/config/env.js');
const { query } = await import('../src/config/pg.js');
const { fetchScrumHubTicketTimeline } = await import(
  '../src/services/scrumhub-support.service.js'
);
const { deliverPendingSupportWhatsapp, syncOpenSupportTickets } = await import(
  '../src/services/support-ticket-center.service.js'
);
const { isWhatsappOutboundConfigured } = await import(
  '../src/services/whatsapp-outbound.service.js'
);

const arg = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
};

console.log('### configuração');
console.table([{
  scrumhub_api_key: env.SCRUMHUB_API_KEY ? `definida (${env.SCRUMHUB_API_KEY.length})` : 'AUSENTE',
  scrumhub_base_url: env.SCRUMHUB_API_BASE_URL || 'padrão',
  sync_habilitado: env.SCRUMHUB_SYNC_ENABLED,
  intervalo_ms: env.SCRUMHUB_SYNC_INTERVAL_MS,
  whatsapp: isWhatsappOutboundConfigured() ? 'configurado' : 'AUSENTE',
}]);

const { rows: links } = await query(
  `select scrumhub_ticket_id, codigo, nome, concluido, requester_email, requester_phone,
          last_synced_at, jsonb_array_length(known_remote_event_keys) as eventos_conhecidos
     from public.support_ticket_links
    order by updated_at desc
    limit 10`,
);
console.log('\n### chamados vinculados');
console.table(links);

const ticketId = arg('ticket') || links[0]?.scrumhub_ticket_id;
if (ticketId) {
  console.log(`\n### timeline bruta do chamado ${ticketId}`);
  try {
    const timeline = await fetchScrumHubTicketTimeline(ticketId);
    console.log(JSON.stringify(timeline, null, 2).slice(0, 4000));
  } catch (error) {
    console.error('falha ao ler timeline:', error.message);
  }
}

console.log('\n### ciclo de sincronização');
console.log(JSON.stringify(await syncOpenSupportTickets({ limit: 20 }), null, 2));

console.log('\n### entrega de WhatsApp pendente');
console.log(JSON.stringify(await deliverPendingSupportWhatsapp({ limit: 20 }), null, 2));

const { rows: eventos } = await query(
  `select e.event_type, e.title, e.read_at, e.whatsapp_sent_at, e.whatsapp_error, e.created_at
     from public.support_ticket_events e
    order by e.created_at desc
    limit 10`,
);
console.log('\n### últimas notificações geradas');
console.table(eventos);

process.exit(0);
