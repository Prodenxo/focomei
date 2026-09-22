import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDestinatarioIeIsentoForEmit,
  normalizePlugnotasNfeIdeForEmit,
} from '../src/services/plugnotas/plugnotas-nfe-payload.js';

const dest = (extra) => ({
  cpfCnpj: '98765432000188',
  razaoSocial: 'BARRAMARES BEACH RESTAURANTE LTDA',
  ...extra,
});

/**
 * Regressão: cliente marcado como isento saía sem o campo de IE e a SEFAZ
 * recusava com "IE do destinatário não informada".
 */
test('isento sai com IE preenchida com ISENTO', () => {
  const result = normalizeDestinatarioIeIsentoForEmit(dest({ indIEDest: '2' }));
  assert.equal(result.inscricaoEstadual, 'ISENTO');
  assert.equal(result.indIEDest, '2');
});

test('IE já informada pelo usuário é preservada', () => {
  const result = normalizeDestinatarioIeIsentoForEmit(
    dest({ indIEDest: '2', inscricaoEstadual: '206432275' }),
  );
  assert.equal(result.inscricaoEstadual, '206432275');
});

test('não contribuinte e contribuinte seguem intocados', () => {
  assert.equal(
    normalizeDestinatarioIeIsentoForEmit(dest({ indIEDest: '9' })).inscricaoEstadual,
    undefined,
  );
  assert.equal(
    normalizeDestinatarioIeIsentoForEmit(dest({ indIEDest: '1', inscricaoEstadual: '123' }))
      .inscricaoEstadual,
    '123',
  );
});

test('a emissão aplica a regra no payload inteiro', () => {
  const payload = normalizePlugnotasNfeIdeForEmit({
    destinatario: dest({ indIEDest: '2' }),
    itens: [],
  });
  assert.equal(payload.destinatario.inscricaoEstadual, 'ISENTO');
});
