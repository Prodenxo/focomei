import test from 'node:test';
import assert from 'node:assert/strict';

test('persistência DAS em AUTH local não exige SUPABASE_URL', async () => {
  const originalAuthMode = process.env.AUTH_MODE;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalDb = process.env.DATABASE_URL;
  process.env.AUTH_MODE = 'local';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.DATABASE_URL;
  delete process.env.SUPABASE_DB_URL;

  try {
    const { upsertDasBase64 } = await import('../src/services/mei-guide-das-base64.service.js');
    await assert.rejects(
      () => upsertDasBase64({
        userId: '11111111-1111-1111-1111-111111111111',
        periodoApuracao: '202601',
        pdfBase64: 'JVBERi0=',
      }),
      (error) => {
        const message = String(error?.message || '');
        assert.doesNotMatch(message, /Supabase não configurado para persistência do DAS/i);
        assert.match(
          message,
          /DATABASE_URL|SUPABASE_DB_URL|connect|Postgres|pool|das_mei|foreign key/i,
        );
        return true;
      },
    );
  } finally {
    process.env.AUTH_MODE = originalAuthMode;
    if (originalUrl !== undefined) process.env.SUPABASE_URL = originalUrl;
    else delete process.env.SUPABASE_URL;
    if (originalKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (originalDb !== undefined) process.env.DATABASE_URL = originalDb;
    else delete process.env.DATABASE_URL;
  }
});
