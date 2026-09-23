import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const { env } = await import('../src/config/env.js');
const { requestWithMtls } = await import('../src/utils/http-mtls.js');

console.log('base url:', env.SERPRO_API_BASE_URL);
console.log('token url:', env.SERPRO_OAUTH_TOKEN_URL);
console.log('no mtls:', env.SERPRO_OAUTH_TOKEN_NO_MTLS);
console.log('role type:', env.SERPRO_ROLE_TYPE);
console.log('cert pfx:', env.SERPRO_CERT_PFX_BASE64 ? 'presente' : 'ausente');

const credentials = Buffer.from(
  `${env.SERPRO_CONSUMER_KEY}:${env.SERPRO_CONSUMER_SECRET}`,
).toString('base64');

const options = {
  method: 'POST',
  headers: {
    Authorization: `Basic ${credentials}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Role-Type': env.SERPRO_ROLE_TYPE,
  },
  body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
};

const started = Date.now();
let response;
if (String(env.SERPRO_OAUTH_TOKEN_NO_MTLS).toLowerCase() === 'true' || !env.SERPRO_CERT_PFX_BASE64) {
  response = await fetch(env.SERPRO_OAUTH_TOKEN_URL, options);
} else {
  response = await requestWithMtls(env.SERPRO_OAUTH_TOKEN_URL, {
    ...options,
    pfx: Buffer.from(env.SERPRO_CERT_PFX_BASE64, 'base64'),
    passphrase: env.SERPRO_CERT_PFX_PASS || undefined,
  });
}

const text = await response.text();
console.log(`\nHTTP ${response.status} em ${Date.now() - started}ms`);
try {
  const json = JSON.parse(text);
  const masked = { ...json };
  for (const key of ['access_token', 'jwt_token']) {
    if (masked[key]) masked[key] = `<${String(masked[key]).length} chars>`;
  }
  console.log(JSON.stringify(masked, null, 2));
} catch {
  console.log(text.slice(0, 1000));
}
