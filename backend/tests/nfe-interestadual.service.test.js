import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyInterestadualTaxasToItem,
  isInterestadualOperation,
  parseAliquotaIcms,
  toInterestadualCfop,
  normalizeUf,
} from '../src/services/nfe-interestadual.service.js';

test('normalizeUf e isInterestadualOperation', () => {
  assert.equal(normalizeUf('rj'), 'RJ');
  assert.equal(isInterestadualOperation('RJ', 'RJ'), false);
  assert.equal(isInterestadualOperation('RJ', 'SP'), true);
  assert.equal(isInterestadualOperation('', 'SP'), false);
  assert.equal(isInterestadualOperation('RJ', ''), false);
});

test('toInterestadualCfop 5xxx → 6xxx', () => {
  assert.equal(toInterestadualCfop('5102'), '6102');
  assert.equal(toInterestadualCfop('5405'), '6405');
  assert.equal(toInterestadualCfop('6102'), '6102');
  assert.equal(toInterestadualCfop(''), '6102');
});

test('parseAliquotaIcms', () => {
  assert.equal(parseAliquotaIcms('12'), 12);
  assert.equal(parseAliquotaIcms('12,5'), 12.5);
  assert.equal(parseAliquotaIcms(-1), null);
  assert.equal(parseAliquotaIcms(101), null);
  assert.equal(parseAliquotaIcms(''), null);
});

test('applyInterestadualTaxasToItem CSOSN 102 não exige alíquota', () => {
  const item = applyInterestadualTaxasToItem(
    {
      cfop: '5102',
      valor: 100,
      tributos: { icms: { origem: '0', cst: '102' } },
    },
    {},
  );
  assert.equal(item.cfop, '6102');
  assert.deepEqual(item.tributos.icms, { origem: '0', cst: '102' });
});

test('applyInterestadualTaxasToItem com CSOSN 900 exige alíquota', () => {
  assert.throws(
    () => applyInterestadualTaxasToItem(
      { cfop: '5102', valor: 100, tributos: { icms: { origem: '0', cst: '900' } } },
      { csosn: '900' },
    ),
    (err) => err?.errors?.code === 'NFE_INTERESTADUAL_TAX_REQUIRED' || /alíquota/i.test(err?.message || ''),
  );
});

test('applyInterestadualTaxasToItem com CSOSN 900 inclui cálculo', () => {
  const item = applyInterestadualTaxasToItem(
    {
      cfop: '5102',
      valor: 100,
      tributos: { icms: { origem: '0', cst: '900' } },
    },
    { aliquotaIcms: 12, csosn: '900' },
  );
  assert.equal(item.cfop, '6102');
  assert.equal(item.tributos.icms.cst, '900');
  assert.deepEqual(item.tributos.icms.baseCalculo, { valor: 100 });
  assert.equal(item.tributos.icms.aliquota, 12);
  assert.equal(item.tributos.icms.valor, 12);
});
