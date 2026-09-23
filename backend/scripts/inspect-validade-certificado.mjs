import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import pg from 'pg';
import forge from 'node-forge';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const email = process.argv[2];
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const client = new pg.Client({
  connectionString,
  ssl: /sslmode=disable/i.test(connectionString) ? false : { rejectUnauthorized: false },
});
await client.connect();

const { rows } = await client.query(
  `SELECT u.email, c.user_id, c.cert_document, c.cert_valid_from, c.cert_valid_to,
          c.pfx_base64, c.passphrase_enc, c.passphrase_iv, c.updated_at
   FROM public.user_mei_certificates c
   JOIN public.users u ON u.id = c.user_id
   WHERE c.pfx_base64 IS NOT NULL
     AND ($1::text IS NULL OR u.email = $1)
   ORDER BY c.updated_at DESC`,
  [email || null],
);
await client.end();

const store = await import('../src/services/mei-certificate-store.js');
const hoje = new Date();

console.log(`### certificados analisados: ${rows.length}\n`);
const vencidos = [];

for (const r of rows) {
  let senha;
  try {
    senha = store.decryptPassphrase(r.passphrase_enc, r.passphrase_iv);
  } catch {
    console.log(`* SENHA ILEGIVEL | ${r.email} | cnpj=${r.cert_document}`);
    continue;
  }
  try {
    const der = forge.util.createBuffer(Buffer.from(r.pfx_base64, 'base64').toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), senha);
    const bag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0];
    const validade = bag?.cert?.validity;
    const ate = validade?.notAfter ? new Date(validade.notAfter) : null;
    const expirado = ate ? ate < hoje : null;
    const marca = expirado === null ? 'SEM DATA' : expirado ? 'EXPIRADO' : 'ok';
    console.log(
      `* ${marca.padEnd(8)} | ${r.email} | cnpj=${r.cert_document} | validade=${ate ? ate.toISOString().slice(0, 10) : '-'} | enviado=${r.updated_at?.toISOString?.().slice(0, 10)} | banco_valid_to=${r.cert_valid_to ? new Date(r.cert_valid_to).toISOString().slice(0, 10) : '-'}`,
    );
    if (expirado) vencidos.push({ email: r.email, cnpj: r.cert_document, ate });
  } catch (error) {
    console.log(`* PFX ILEGIVEL | ${r.email} | cnpj=${r.cert_document} | ${error?.message}`);
  }
}

console.log(`\n### expirados: ${vencidos.length}`);
for (const v of vencidos) console.log(`* ${v.email} | ${v.cnpj} | venceu em ${v.ate.toISOString().slice(0, 10)}`);
