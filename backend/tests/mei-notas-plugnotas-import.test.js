import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';
process.env.PLUGNOTAS_API_BASE_URL = process.env.PLUGNOTAS_API_BASE_URL || 'https://plugnotas.example.com';
process.env.PLUGNOTAS_API_KEY = process.env.PLUGNOTAS_API_KEY || 'plugnotas-key';
process.env.AUTH_MODE = process.env.AUTH_MODE || 'local';

test('shouldPersistImportedNota aceita só concluido, cancelado e rejeitado', async () => {
  const { shouldPersistImportedNota } = await import(
    '../src/services/mei-notas-plugnotas-import.service.js'
  );
  assert.equal(shouldPersistImportedNota('concluido'), true);
  assert.equal(shouldPersistImportedNota('cancelado'), true);
  assert.equal(shouldPersistImportedNota('rejeitado'), true);
  assert.equal(shouldPersistImportedNota('processando'), false);
  assert.equal(shouldPersistImportedNota('cancelamento_pendente'), false);
});

test('buildPlugnotasPeriodoWindows respeita limite de 31 dias por janela', async () => {
  const { buildPlugnotasPeriodoWindows } = await import(
    '../src/services/mei-notas-plugnotas-import.service.js'
  );
  const windows = buildPlugnotasPeriodoWindows('2026-01-01', '2026-03-15');
  assert.ok(windows.length >= 2);
  for (const window of windows) {
    const start = new Date(`${window.dataInicial}T12:00:00.000Z`);
    const end = new Date(`${window.dataFinal}T12:00:00.000Z`);
    const diffDays = Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
    assert.ok(diffDays <= 31);
  }
  assert.equal(windows[0].dataFinal, '2026-03-15');
});

test('importarHistoricoPlugnotas exige CNPJ do prestador', async () => {
  const { importarHistoricoPlugnotas } = await import(
    '../src/services/mei-notas-plugnotas-import.service.js'
  );
  await assert.rejects(
    () => importarHistoricoPlugnotas('11111111-1111-1111-1111-111111111111', {}),
    /CNPJ do prestador não identificado/i,
  );
});

test('importarHistoricoPlugnotas usa CNPJ informado no body', async () => {
  const originalFetch = global.fetch;
  let periodoCalls = 0;

  global.fetch = async (url) => {
    if (String(url).includes('/nfse/consultar/periodo')) {
      periodoCalls += 1;
      return new Response(
        JSON.stringify({
          hashProximaPagina: null,
          notas: [
            {
              id: 'nfse-remota-1',
              idIntegracao: 'int-hist-1',
              status: 'CONCLUIDO',
              tomador: { cpfCnpj: '12345678901', razaoSocial: 'Cliente Teste' },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({ message: 'unexpected' }), { status: 500 });
  };

  const inserted = [];
  const { createSupabaseClient } = await import('../src/config/supabase.js');
  const originalCreate = createSupabaseClient;
  const mockModule = await import('../src/services/mei-notas-plugnotas-import.service.js');

  try {
    const result = await mockModule.importarHistoricoPlugnotas(
      '22222222-2222-2222-2222-222222222222',
      { cnpj: '17177014000188', maxPages: 2 },
    );
    assert.equal(periodoCalls >= 1, true);
    assert.equal(result.cnpjPrestador, '17177014000188');
    assert.ok(result.totalFetched >= 1);
    assert.ok(result.imported + result.updated + result.skipped >= 0);
  } finally {
    global.fetch = originalFetch;
    void inserted;
    void originalCreate;
  }
});
