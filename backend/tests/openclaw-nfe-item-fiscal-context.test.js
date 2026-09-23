import test from 'node:test';
import assert from 'node:assert/strict';
import { applyNfeItemFiscalContext } from '../src/services/openclaw-nfe.service.js';

const item = (cfop) => ({ descricao: 'COENTRO', ncm: '07099900', cfop, valor: 92 });

/**
 * Regressão: a venda interna lia uma variável inexistente e estourava
 * "interestadual is not defined", derrubando toda emissão de NF-e pelo robô.
 */
test('venda interna não quebra e normaliza o CFOP para 5102', () => {
  const ctx = { interestadual: false, emitenteUf: 'CE', destinatarioUf: 'CE' };

  assert.equal(applyNfeItemFiscalContext(item('5102'), ctx).cfop, '5102');
  assert.equal(applyNfeItemFiscalContext(item(''), ctx).cfop, '5102');
  assert.equal(applyNfeItemFiscalContext(item(null), ctx).cfop, '5102');
});

test('contexto ausente não derruba a emissão', () => {
  assert.equal(applyNfeItemFiscalContext(item('5102'), undefined).cfop, '5102');
  assert.equal(applyNfeItemFiscalContext(item('5102'), null).cfop, '5102');
});

test('CFOP 6xxx de catálogo legado é preservado em venda interna', () => {
  const ctx = { interestadual: false };
  assert.equal(applyNfeItemFiscalContext(item('6102'), ctx).cfop, '6102');
});

test('venda para outro estado aplica as taxas cadastradas', () => {
  const ctx = {
    interestadual: true,
    destinatarioUf: 'RN',
    taxas: { ufDestino: 'RN', aliquotaIcms: null, csosn: null, cfop: null },
  };
  const result = applyNfeItemFiscalContext(item('5102'), ctx);

  assert.equal(String(result.cfop).startsWith('6'), true);
});
