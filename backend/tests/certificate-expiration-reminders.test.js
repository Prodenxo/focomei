import assert from 'node:assert/strict';
import test from 'node:test';

import {
  certificateDisplayName,
  daysBetweenIsoDates,
  formatCertificateExpirationWhatsappMessage,
  groupPendingByRecipient,
} from '../src/services/certificate-expiration-reminders.service.js';
import { CERTIFICATE_EXPIRATION_NOTIFICATIONS_SQL } from '../src/services/db-bootstrap.service.js';

const certificate = {
  id: 'cert-1',
  user_id: 'cliente-1',
  empresa_id: 'escritorio-1',
  cert_document: '12345678000190',
  cert_valid_to: '2026-10-24T23:59:59.000Z',
  nome_fantasia: 'Loja da Maria',
};

test('calcula os 30 dias sem depender do horário do certificado', () => {
  assert.equal(daysBetweenIsoDates('2026-09-24', certificate.cert_valid_to), 30);
  assert.equal(
    daysBetweenIsoDates('2026-09-24', new Date(certificate.cert_valid_to)),
    30,
  );
});

test('mensagem informa empresa, prazo e data em linguagem simples', () => {
  const message = formatCertificateExpirationWhatsappMessage({
    certificates: [certificate],
    todayIso: '2026-09-24',
  });
  assert.match(message, /Loja da Maria/);
  assert.match(message, /vence em 30 dias/);
  assert.match(message, /24\/10\/2026/);
  assert.match(message, /renovação/);
});

test('usa razão social e depois CNPJ quando não há nome fantasia', () => {
  assert.equal(certificateDisplayName({ razao_social: 'Maria LTDA' }), 'Maria LTDA');
  assert.equal(
    certificateDisplayName({ cert_document: '12345678000190' }),
    'CNPJ 12345678000190',
  );
});

test('aviso vai ao administrador ativo do escritório com WhatsApp', () => {
  const result = groupPendingByRecipient({
    certificates: [certificate],
    memberships: [{
      user_id: 'cliente-1',
      empresas_id: 'escritorio-1',
    }],
    adminLinks: [{
      user_id: 'contador-1',
      empresas_id: 'escritorio-1',
    }],
    phones: new Map([['contador-1', '5521999999999']]),
    sentKeys: new Set(),
  });

  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].recipientUserId, 'contador-1');
  assert.equal(result.groups[0].phone, '5521999999999');
  assert.deepEqual(result.groups[0].certificates, [certificate]);
});

test('não repete um certificado já avisado ao mesmo responsável', () => {
  const key = 'cert-1:contador-1:2026-10-24';
  const result = groupPendingByRecipient({
    certificates: [certificate],
    memberships: [],
    adminLinks: [{
      user_id: 'contador-1',
      empresas_id: 'escritorio-1',
    }],
    phones: new Map([['contador-1', '5521999999999']]),
    sentKeys: new Set([key]),
  });

  assert.equal(result.groups.length, 0);
  assert.equal(result.withoutResponsible.length, 0);
});

test('o bootstrap cria a trava persistente contra mensagens repetidas', () => {
  assert.match(CERTIFICATE_EXPIRATION_NOTIFICATIONS_SQL, /certificate_expiration_notifications/);
  assert.match(
    CERTIFICATE_EXPIRATION_NOTIFICATIONS_SQL,
    /unique \(certificate_id, recipient_user_id, cert_valid_to\)/,
  );
});
