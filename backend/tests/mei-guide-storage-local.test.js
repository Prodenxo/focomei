import test from 'node:test';
import assert from 'node:assert/strict';

test('deleteStoredDasPdf no-op em AUTH local mesmo com SUPABASE_URL legado', async () => {
  const originalAuthMode = process.env.AUTH_MODE;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.AUTH_MODE = 'local';
  process.env.SUPABASE_URL = 'https://legacy.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-key';

  try {
    const { deleteStoredDasPdf, downloadStoredDasPdfBuffer } = await import(
      '../src/services/mei-guide-storage.service.js'
    );
    await assert.doesNotReject(() =>
      deleteStoredDasPdf({
        userId: '11111111-1111-1111-1111-111111111111',
        competencia: '2026-04',
        periodoApuracao: '202604',
      }),
    );
    const buffer = await downloadStoredDasPdfBuffer({
      userId: '11111111-1111-1111-1111-111111111111',
      competencia: '2026-04',
      periodoApuracao: '202604',
    });
    assert.equal(buffer, null);
  } finally {
    process.env.AUTH_MODE = originalAuthMode;
    if (originalUrl !== undefined) process.env.SUPABASE_URL = originalUrl;
    else delete process.env.SUPABASE_URL;
    if (originalKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});
