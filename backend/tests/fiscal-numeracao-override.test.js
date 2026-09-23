import test from 'node:test';
import assert from 'node:assert/strict';
import {
  consumeFiscalNumeracaoOverride,
  readFiscalNumeracaoOverride,
  setFiscalNumeracaoOverride,
} from '../src/services/plugnotas/fiscal-numeracao-override.js';

const CNPJ = '12345678000199';

/** Stub mínimo do supabase-js: guarda a última chamada e devolve o que o teste pedir. */
const makeDb = (handlers = {}) => {
  const calls = [];
  const client = {
    from(table) {
      const ctx = { table, filters: {} };
      const chain = {
        upsert(row, options) {
          calls.push({ op: 'upsert', table, row, options });
          return handlers.upsert ?? { error: null };
        },
        delete() {
          calls.push({ op: 'delete', table, ctx });
          return chain;
        },
        select(columns) {
          calls.push({ op: 'select', table, columns });
          return chain;
        },
        eq(column, value) {
          ctx.filters[column] = value;
          return chain;
        },
        maybeSingle() {
          calls.push({ op: 'maybeSingle', filters: { ...ctx.filters } });
          return handlers.maybeSingle ?? { data: null, error: null };
        },
        then(resolve) {
          return Promise.resolve(handlers.delete ?? { error: null }).then(resolve);
        },
      };
      return chain;
    },
  };
  return { getDb: () => client, calls };
};

test('setFiscalNumeracaoOverride grava o próximo número normalizando CNPJ e tipo', async () => {
  const { getDb, calls } = makeDb();

  const ok = await setFiscalNumeracaoOverride(getDb, {
    cnpj: '12.345.678/0001-99',
    documentType: 'NFSE',
    nextNumero: 43,
    serie: '1',
    userId: 'user-1',
  });

  assert.equal(ok, true);
  const upsert = calls.find((c) => c.op === 'upsert');
  assert.equal(upsert.table, 'mei_fiscal_numeracao_overrides');
  assert.equal(upsert.row.cnpj, CNPJ);
  assert.equal(upsert.row.document_type, 'nfse');
  assert.equal(upsert.row.next_numero, 43);
  assert.equal(upsert.row.requested_by, 'user-1');
});

test('setFiscalNumeracaoOverride recusa CNPJ ou tipo inválido sem tocar no banco', async () => {
  const { getDb, calls } = makeDb();

  assert.equal(await setFiscalNumeracaoOverride(getDb, {
    cnpj: '123',
    documentType: 'NFSE',
    nextNumero: 5,
  }), false);
  assert.equal(await setFiscalNumeracaoOverride(getDb, {
    cnpj: CNPJ,
    documentType: 'NFCE',
    nextNumero: 5,
  }), false);
  assert.equal(await setFiscalNumeracaoOverride(getDb, {
    cnpj: CNPJ,
    documentType: 'NFE',
    nextNumero: 0,
  }), false);
  assert.equal(calls.length, 0);
});

test('readFiscalNumeracaoOverride devolve null quando a tabela ainda não existe', async () => {
  const { getDb } = makeDb({
    maybeSingle: { data: null, error: { message: 'relation "mei_fiscal_numeracao_overrides" does not exist' } },
  });

  assert.equal(await readFiscalNumeracaoOverride(getDb, {
    cnpj: CNPJ,
    documentType: 'NFSE',
  }), null);
});

test('readFiscalNumeracaoOverride devolve número e série gravados', async () => {
  const { getDb } = makeDb({
    maybeSingle: { data: { next_numero: 43, serie: '2' }, error: null },
  });

  assert.deepEqual(await readFiscalNumeracaoOverride(getDb, {
    cnpj: CNPJ,
    documentType: 'NFE',
  }), { numero: 43, serie: '2' });
});

test('consumeFiscalNumeracaoOverride filtra por CNPJ e tipo', async () => {
  const { getDb, calls } = makeDb();

  await consumeFiscalNumeracaoOverride(getDb, { cnpj: CNPJ, documentType: 'NFSE' });

  const del = calls.find((c) => c.op === 'delete');
  assert.equal(del.table, 'mei_fiscal_numeracao_overrides');
  assert.deepEqual(del.ctx.filters, { cnpj: CNPJ, document_type: 'nfse' });
});
