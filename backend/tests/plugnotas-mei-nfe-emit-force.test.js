import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyMeiNfeEmitForcePolicy,
  applyPlugnotasNfeEmitenteIeForXml,
  buildMeiNfePreEmitEmpresaPatch,
  buildMeiNfePreEmitEmpresaPatches,
  hydrateMeiNfeEmitenteIeFromEmpresa,
  isPlugnotasNfeEmitenteIeNumericForXml,
  isPlugnotasNfeSchemaRejectionMissingEmitenteIe,
  resolvePlugnotasNfeEmitenteInscricaoEstadualForXml,
} from '../src/services/plugnotas/plugnotas-mei-nfe-emit-force.js';

test('isPlugnotasNfeEmitenteIeNumericForXml aceita IE numérica e rejeita ISENTO', () => {
  assert.equal(isPlugnotasNfeEmitenteIeNumericForXml('9076543210'), true);
  assert.equal(isPlugnotasNfeEmitenteIeNumericForXml('ISENTO'), false);
  assert.equal(isPlugnotasNfeEmitenteIeNumericForXml(''), false);
});

test('resolvePlugnotasNfeEmitenteInscricaoEstadualForXml prioriza emitente numérico', () => {
  const ie = resolvePlugnotasNfeEmitenteInscricaoEstadualForXml(
    { inscricaoEstadual: '1234567890' },
    { inscricaoEstadual: 'ISENTO' },
  );
  assert.equal(ie, '1234567890');
});

test('applyMeiNfeEmitForcePolicy não preenche ISENTO e remove crt do JSON', () => {
  const prev = process.env.MEI_NFE_FORCE_CRT_EMIT;
  process.env.MEI_NFE_FORCE_CRT_EMIT = 'true';

  try {
    const out = applyMeiNfeEmitForcePolicy({
      emitente: { cpfCnpj: '67146579000176', crt: 4 },
      crt: 4,
      config: { producao: true },
    });

    assert.equal(out.crt, undefined);
    assert.equal(out.emitente.crt, undefined);
    assert.equal(out.emitente.inscricaoEstadual, undefined);
    assert.equal(out.config.versaoEsquema, 'pl_010c');
  } finally {
    if (prev === undefined) delete process.env.MEI_NFE_FORCE_CRT_EMIT;
    else process.env.MEI_NFE_FORCE_CRT_EMIT = prev;
  }
});

test('applyMeiNfeEmitForcePolicy preserva IE numérica informada no emitente', () => {
  const out = applyMeiNfeEmitForcePolicy({
    emitente: {
      cpfCnpj: '67146579000176',
      inscricaoEstadual: '12345678901',
    },
  });
  assert.equal(out.emitente.inscricaoEstadual, '12345678901');
});

test('applyPlugnotasNfeEmitenteIeForXml normaliza IE numérica', () => {
  const out = applyPlugnotasNfeEmitenteIeForXml({
    emitente: { cpfCnpj: '67146579000176', inscricaoEstadual: '12.345.678-9' },
  }, { inscricaoEstadual: 'ISENTO' });
  assert.equal(out.emitente.inscricaoEstadual, '123456789');
});

test('applyPlugnotasNfeEmitenteIeForXml lança erro quando só há ISENTO', () => {
  assert.throws(
    () => applyPlugnotasNfeEmitenteIeForXml(
      { emitente: { cpfCnpj: '67146579000176', inscricaoEstadual: 'ISENTO' } },
      { inscricaoEstadual: 'ISENTO' },
    ),
    /Inscrição Estadual numérica/,
  );
});

test('buildMeiNfePreEmitEmpresaPatches versaoEsquema não inclui bloco nfse', () => {
  const patches = buildMeiNfePreEmitEmpresaPatches({
    nfe: { ativo: true, config: { versaoEsquema: 'pl_009' } },
  }, '67146579000176');

  assert.equal(patches.length, 2);
  assert.equal(patches[0].inscricaoEstadual, 'ISENTO');
  assert.equal(patches[1].nfe?.config?.versaoEsquema, 'pl_010c');
  assert.equal(patches[1].nfse, undefined);
});

test('buildMeiNfePreEmitEmpresaPatch pede IE quando versaoEsquema já está ok', () => {
  const { needsPatch, patch } = buildMeiNfePreEmitEmpresaPatch({
    inscricaoEstadual: '',
    nfe: { ativo: true, config: { versaoEsquema: 'pl_010c' } },
  }, '67146579000176');

  assert.equal(needsPatch, true);
  assert.equal(patch?.inscricaoEstadual, 'ISENTO');
  assert.equal(patch?.nfe, undefined);
});

test('buildMeiNfePreEmitEmpresaPatch não altera cadastro quando IE e versao ok', () => {
  const { needsPatch, patch } = buildMeiNfePreEmitEmpresaPatch({
    inscricaoEstadual: 'ISENTO',
    nfe: { ativo: true, config: { versaoEsquema: 'pl_010c' } },
  }, '67146579000176');

  assert.equal(needsPatch, false);
  assert.equal(patch, null);
});

test('hydrateMeiNfeEmitenteIeFromEmpresa usa IE numérica do cadastro', () => {
  const out = hydrateMeiNfeEmitenteIeFromEmpresa(
    { emitente: { cpfCnpj: '67146579000176' } },
    { inscricaoEstadual: '987654321' },
  );
  assert.equal(out.emitente.inscricaoEstadual, '987654321');
});

test('hydrateMeiNfeEmitenteIeFromEmpresa ignora ISENTO do cadastro', () => {
  const out = hydrateMeiNfeEmitenteIeFromEmpresa(
    { emitente: { cpfCnpj: '67146579000176' } },
    { inscricaoEstadual: 'ISENTO' },
  );
  assert.equal(out.emitente.inscricaoEstadual, undefined);
});

test('isPlugnotasNfeSchemaRejectionMissingEmitenteIe detecta erro CRT/IE', () => {
  const msg = "Invalid content was found starting with element 'CRT'. One of 'IE' is expected.";
  assert.equal(isPlugnotasNfeSchemaRejectionMissingEmitenteIe(msg), true);
});
