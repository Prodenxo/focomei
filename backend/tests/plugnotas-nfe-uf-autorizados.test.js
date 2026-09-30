import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyUfResponsavelAutorizado,
  resolveUfAutorizadoXmlPadrao,
} from '../src/services/plugnotas/plugnotas-nfe-uf-autorizados.js';

const basePayload = {
  emitente: { cpfCnpj: '69025467000192' },
  destinatario: { cpfCnpj: '65446108000158' },
  itens: [{ valor: 10 }],
};

test('emitente da Bahia recebe o CNPJ da SEFAZ Bahia como autorizado', () => {
  const next = applyUfResponsavelAutorizado(basePayload, 'BA');
  assert.deepEqual(next.responsavelAutorizado, [{ cpfCnpj: '13937073000156' }]);
  assert.equal(resolveUfAutorizadoXmlPadrao('ba'), '13937073000156');
});

test('outros estados não ganham o grupo de autorizados', () => {
  assert.equal(applyUfResponsavelAutorizado(basePayload, 'RJ'), basePayload);
  assert.equal(applyUfResponsavelAutorizado(basePayload, ''), basePayload);
  assert.equal(resolveUfAutorizadoXmlPadrao('SP'), '');
});

test('autorizado já informado pelo cliente é preservado', () => {
  const comContador = {
    ...basePayload,
    responsavelAutorizado: [{ cpfCnpj: '11.222.333/0001-81' }],
  };
  const next = applyUfResponsavelAutorizado(comContador, 'BA');
  assert.equal(next, comContador);
});

test('contador informado no cadastro vale em qualquer estado e ganha do padrão da Bahia', () => {
  const rj = applyUfResponsavelAutorizado(basePayload, 'RJ', { contadorCnpj: '11.222.333/0001-81' });
  assert.deepEqual(rj.responsavelAutorizado, [{ cpfCnpj: '11222333000181' }]);

  const ba = applyUfResponsavelAutorizado(basePayload, 'BA', { contadorCnpj: '11222333000181' });
  assert.deepEqual(ba.responsavelAutorizado, [{ cpfCnpj: '11222333000181' }]);

  const invalido = applyUfResponsavelAutorizado(basePayload, 'BA', { contadorCnpj: '123' });
  assert.deepEqual(invalido.responsavelAutorizado, [{ cpfCnpj: '13937073000156' }]);
});

test('contador igual ao destinatário não entra; na Bahia cai para o padrão', () => {
  const mesmoDoc = applyUfResponsavelAutorizado(basePayload, 'BA', { contadorCnpj: '65446108000158' });
  assert.deepEqual(mesmoDoc.responsavelAutorizado, [{ cpfCnpj: '13937073000156' }]);
  assert.equal(applyUfResponsavelAutorizado(basePayload, 'SP', { contadorCnpj: '65446108000158' }), basePayload);
});

test('lista vazia ou inválida é tratada como ausente', () => {
  const vazio = { ...basePayload, responsavelAutorizado: [] };
  assert.deepEqual(applyUfResponsavelAutorizado(vazio, 'BA').responsavelAutorizado, [{ cpfCnpj: '13937073000156' }]);
  const invalido = { ...basePayload, responsavelAutorizado: [{ cpfCnpj: '123' }] };
  assert.deepEqual(applyUfResponsavelAutorizado(invalido, 'BA').responsavelAutorizado, [{ cpfCnpj: '13937073000156' }]);
});
