/**
 * One-time: cadastra CPF do admin signatário da CF ALIANCA LTDA.
 * Uso: node backend/scripts/one-time/fix-cf-alanca-admin-cpf.mjs
 * Requer DATABASE_URL (ou env do backend).
 */
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const EMPRESA_ID = '5903bdd8-d1c7-44e2-b323-250c85771b98';
const ADMIN_EMAIL = 'contato@cfalianca.com.br';
const CPF = '96232137515';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT u.id, u.email, u.raw_user_meta_data
       FROM public.role_x_user_x_empresa rx
       JOIN public.roles r ON r.id = rx.roles_id AND lower(r.roles) = 'admin'
       JOIN public.users u ON u.id = rx.user_id
       WHERE rx.empresas_id = $1
       LIMIT 1`,
      [EMPRESA_ID],
    );
    const admin = rows[0];
    if (!admin) {
      console.error('Admin não encontrado para empresa', EMPRESA_ID);
      process.exit(1);
    }

    const existingCpf = String(admin.raw_user_meta_data?.cpf || '').replace(/\D/g, '');
    if (existingCpf === CPF) {
      console.log('CPF já cadastrado para', admin.email);
      return;
    }

    if (existingCpf && existingCpf !== CPF) {
      console.error(
        'Admin já tem outro CPF:',
        existingCpf,
        '- abortando para evitar sobrescrever.',
      );
      process.exit(1);
    }

    await client.query(
      `UPDATE public.users
       SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
       WHERE id = $1`,
      [admin.id, JSON.stringify({ cpf: CPF })],
    );

    console.log('CPF cadastrado para', admin.email, '(', admin.id, ')');
    console.log('Próximo passo: regerar contrato Onety para CF ALIANCA LTDA.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
