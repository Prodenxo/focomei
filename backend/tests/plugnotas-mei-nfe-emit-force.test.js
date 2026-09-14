import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMeiNfeEmitConfigFromEmpresa,
  applyMeiNfeEmitForcePolicy,
  PLUGNOTAS_CRT_MEI,
  PLUGNOTAS_NFE_VERSAO_ESQUEMA_MEI,
} from '../src/services/plugnotas/plugnotas-mei-nfe-emit-force.js';

test('applyMeiNfeEmitForcePolicy define CRT 4 no emitente quando há IE numérica', () => {
  const out = applyMeiNfeEmitForcePolicy({
    emitente: { cpfCnpj: '67593254000131', inscricaoEstadual: '16508705' },
    config: {},
  });
  assert.equal(out.emitente.crt, PLUGNOTAS_CRT_MEI);
  assert.equal(out.config.versaoEsquema, PLUGNOTAS_NFE_VERSAO_ESQUEMA_MEI);
});

test('applyMeiNfeEmitForcePolicy não define CRT quando IE é ISENTO', () => {
  const out = applyMeiNfeEmitForcePolicy({
    emitente: { cpfCnpj: '67593254000131', inscricaoEstadual: 'ISENTO' },
    config: {},
  });
  assert.equal(out.emitente.crt, undefined);
});

test('applyMeiNfeEmitConfigFromEmpresa copia producao false do cadastro NF-e', () => {
  const out = applyMeiNfeEmitConfigFromEmpresa(
    { config: { producao: true } },
    { nfe: { config: { producao: false } } },
  );
  assert.equal(out.config.producao, false);
});

test('applyMeiNfeEmitConfigFromEmpresa copia versaoEsquema pl_010e do cadastro', () => {
  const out = applyMeiNfeEmitConfigFromEmpresa(
    { config: { producao: true, versaoEsquema: 'pl_010c' } },
    { nfe: { config: { producao: false, versaoEsquema: 'pl_010e' } } },
  );
  assert.equal(out.config.versaoEsquema, 'pl_010e');
  assert.equal(out.config.producao, false);
});
