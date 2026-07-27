#!/usr/bin/env node
/**
 * Import MeiInfinito → FocoMEI (AUTH_MODE=local)
 *
 * Dry-run (padrão — não grava):
 *   node scripts/one-time/import-focomei-migration-20260727/import.mjs
 *
 * Apply (precisa DATABASE_URL):
 *   node scripts/one-time/import-focomei-migration-20260727/import.mjs --apply
 *
 * Opções:
 *   --package=<path>   (default: path fixo do export MeiInfinito)
 *   --dry-run          (explícito; padrão)
 */
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../../.env') })

const DEFAULT_PACKAGE =
  'C:\\Users\\Usuário\\Documents\\Dev\\Meu Financeiro\\Site\\backend\\scripts\\one-time\\exports\\focomei-migration-20260727'

const args = parseArgs(process.argv.slice(2))
const APPLY = Boolean(args.apply)
const PACKAGE_DIR = path.resolve(
  String(args.package || process.env.FOCOMEI_MIGRATION_PACKAGE || DEFAULT_PACKAGE),
)

const ROLE_NAME_TO_PROFILE = {
  admin: 'admin',
  superadmin: 'superadmin',
  user: 'usuario',
  usuario: 'usuario',
  outsider: 'outsider',
}

const USER_TABLES = [
  'categorias_id',
  'contas_financeiras',
  'contas_moeda_global',
  'n8n_link',
  'recorrencias',
  'recorrencia_skips',
  'lancamentos_id',
  'orcamentos',
  'mei_nfse_clientes',
  'mei_nfse_produtos',
  'mei_nfse_servicos',
  'mei_nfse',
  'mei_nfse_rps_counters',
  'das_mensal_status',
  'das_mei',
  'parcelamento_pdfs',
  'google_tokens_id',
]

main().catch((err) => {
  console.error(err?.stack || err)
  process.exit(1)
})

async function main () {
  console.log(APPLY ? '=== APPLY (grava no Postgres) ===' : '=== DRY-RUN (não grava) ===')
  console.log(`Package: ${PACKAGE_DIR}`)

  const report = validatePackage(PACKAGE_DIR)
  printDryRunReport(report)

  if (!APPLY) {
    console.log('\nDry-run OK. Para gravar: configure DATABASE_URL e rode com --apply')
    writeReportFile(PACKAGE_DIR, report, { applied: false })
    return
  }

  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  if (!dbUrl) {
    console.error('DATABASE_URL ausente — abortei sem gravar.')
    process.exit(2)
  }

  const hasCertKey = Boolean(String(process.env.MEI_CERT_ENCRYPTION_KEY || '').trim())
  console.log(`MEI_CERT_ENCRYPTION_KEY no processo: ${hasCertKey ? 'sim' : 'NÃO'}`)
  if (!hasCertKey) {
    console.warn('⚠ Sem MEI_CERT_ENCRYPTION_KEY — importará PFX legado; descriptografia no app pode falhar.')
  }

  const client = new pg.Client({
    connectionString: encodeDbUrlPassword(dbUrl),
    ssl: /sslmode=disable/i.test(dbUrl) || process.env.DB_SSL === 'false'
      ? false
      : { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    const applyReport = await applyImport(client, PACKAGE_DIR, report)
    printApplyReport(applyReport)
    writeReportFile(PACKAGE_DIR, { ...report, apply: applyReport }, { applied: true })
  } finally {
    await client.end().catch(() => {})
  }
}

function validatePackage (root) {
  const errors = []
  const warnings = []
  const required = [
    '00_manifest.json',
    '01_empresas_mei.json',
    '02_users_and_memberships.json',
    '03_certificates_meta.json',
    '90_validation.sql',
    '99_IMPORT_NOTES_FOCOMEI.md',
  ]
  for (const f of required) {
    if (!fs.existsSync(path.join(root, f))) errors.push(`faltando ${f}`)
  }
  if (errors.length) {
    return { ok: false, errors, warnings, counts: {}, diffs: [] }
  }

  const manifest = readJson(path.join(root, '00_manifest.json'))
  const empresasFile = readJson(path.join(root, '01_empresas_mei.json'))
  const usersFile = readJson(path.join(root, '02_users_and_memberships.json'))
  const certMeta = readJson(path.join(root, '03_certificates_meta.json'))

  const empresaDirs = listDirs(path.join(root, 'empresas'))
  const userDirs = listDirs(path.join(root, 'users'))
  const secretFiles = fs.existsSync(path.join(root, 'secrets', 'certificates'))
    ? fs.readdirSync(path.join(root, 'secrets', 'certificates')).filter((f) => f.endsWith('.json'))
    : []

  const expected = manifest.counts || {}
  const counts = {
    empresas_manifest: expected.empresas,
    empresas_file: Array.isArray(empresasFile) ? empresasFile.length : 0,
    empresas_dirs: empresaDirs.length,
    users_manifest: expected.users,
    users_file: Array.isArray(usersFile.users) ? usersFile.users.length : 0,
    users_dirs: userDirs.length,
    users_mei_true: (manifest.users_mei_true || []).length,
    users_without_profile: (manifest.users_without_profile || []).length,
    empresas_max_mei_sem_mei: (manifest.empresas_max_mei_sem_usuarios_mei || []).length,
    roles: (usersFile.roles || []).length,
    certificates_meta: (certMeta.certificates || []).length,
    certificates_with_pfx_meta: (certMeta.certificates || []).filter((c) => c.has_pfx).length,
    secrets_cert_files: secretFiles.length,
  }

  const diffs = []
  const check = (label, a, b) => {
    if (a !== b) diffs.push({ label, expected: a, found: b })
  }
  check('empresas file vs manifest', expected.empresas, counts.empresas_file)
  check('empresas dirs vs manifest', expected.empresas, counts.empresas_dirs)
  check('users file vs manifest', expected.users, counts.users_file)
  check('users dirs vs manifest', expected.users, counts.users_dirs)
  check('users_mei_true', expected.users_mei_true, counts.users_mei_true)
  check('users_without_profile', expected.users_without_profile, counts.users_without_profile)
  check('certs with_pfx vs secrets', counts.certificates_with_pfx_meta, counts.secrets_cert_files)

  // per-user table tallies
  const tableCounts = Object.fromEntries(USER_TABLES.map((t) => [t, 0]))
  tableCounts.user_mei_certificates = 0
  let memberships = 0
  let membershipsMei = 0
  const empresaIds = new Set((empresasFile || []).map((e) => e.id))
  const userIds = new Set()
  const orphanFks = []

  for (const uid of userDirs) {
    userIds.add(uid)
    const userPath = path.join(root, 'users', uid, 'user.json')
    if (!fs.existsSync(userPath)) {
      errors.push(`users/${uid}/user.json ausente`)
      continue
    }
    const user = readJson(userPath)
    if (user.id !== uid) warnings.push(`user dir ${uid} id interno ${user.id}`)
    for (const m of user.memberships || []) {
      memberships += 1
      if (m.mei === true) membershipsMei += 1
      if (m.empresas_id && !empresaIds.has(m.empresas_id)) {
        orphanFks.push({ type: 'membership.empresas_id', user_id: uid, ref: m.empresas_id })
      }
    }
    for (const table of USER_TABLES) {
      const p = path.join(root, 'users', uid, `${table}.json`)
      if (!fs.existsSync(p)) continue
      const rows = readJson(p)
      if (!Array.isArray(rows)) continue
      tableCounts[table] += rows.length
      if (table === 'das_mensal_status') {
        for (const r of rows) {
          if (r.empresa_id && !empresaIds.has(r.empresa_id)) {
            orphanFks.push({ type: 'das.empresa_id', user_id: uid, ref: r.empresa_id })
          }
        }
      }
    }
    const certMetaPath = path.join(root, 'users', uid, 'certificate.meta.json')
    if (fs.existsSync(certMetaPath)) {
      const rows = readJson(certMetaPath)
      tableCounts.user_mei_certificates += Array.isArray(rows) ? rows.length : 0
      for (const c of rows || []) {
        if (c.has_pfx || c.secret_file) {
          const secretName = `${c.id}.json`
          if (!secretFiles.includes(secretName)) {
            errors.push(`cert ${c.id} sem secrets/certificates/${secretName}`)
          }
        }
      }
    }
  }

  for (const [table, n] of Object.entries(tableCounts)) {
    const exp = expected[table]
    if (exp != null && exp !== n) {
      diffs.push({ label: `table ${table}`, expected: exp, found: n })
    }
  }
  check('vinculos_ativos (memberships)', expected.vinculos_ativos, memberships)
  check('vinculos_mei_true', expected.vinculos_mei_true, membershipsMei)

  if (orphanFks.length) {
    warnings.push(`${orphanFks.length} FKs órfãs (amostra): ${JSON.stringify(orphanFks.slice(0, 5))}`)
  }

  // insert plan summary
  const plan = [
    'roles (UUIDs export Admin/User/Superadmin/Outsider)',
    'public.users (scrypt random + password_reset_required)',
    'profiles (export role; faltantes → usuario; Superadmin no vínculo → superadmin)',
    'empresas',
    'role_x_user_x_empresa',
    'n8n_link',
    'categorias_id (OVERRIDING SYSTEM VALUE)',
    'contas_financeiras',
    'contas_moeda_global',
    'recorrencias → recorrencia_skips',
    'lancamentos_id → orcamentos',
    'user_mei_certificates (legado pfx_base64 + passphrase_enc/iv)',
    'mei_nfse_clientes/produtos → mei_nfse → rps_counters',
    'das_mensal_status / das_mei → parcelamento_pdfs',
    'empresa_mei_subscription_lines (+ invites opcional)',
    'google_tokens_id (best-effort)',
  ]

  const roleMapPreview = (usersFile.roles || []).map((r) => ({
    export_id: r.id,
    export_name: r.roles,
    profile_role: mapProfileRole(r.roles),
  }))

  return {
    ok: errors.length === 0 && diffs.length === 0,
    errors,
    warnings,
    counts: {
      ...counts,
      memberships,
      membershipsMei,
      ...tableCounts,
      expected,
    },
    diffs,
    orphanFksCount: orphanFks.length,
    plan,
    roleMapPreview,
    empresas_max_mei_sem_usuarios_mei: manifest.empresas_max_mei_sem_usuarios_mei || [],
    preserve_uuids: true,
    password_reset_required_all: true,
  }
}

async function applyImport (client, root, dryReport) {
  const manifest = readJson(path.join(root, '00_manifest.json'))
  const usersFile = readJson(path.join(root, '02_users_and_memberships.json'))
  const failures = []
  const inserted = {}
  // Senha descartável única — todos precisam reset; evita 223× scrypt (~2min).
  const sharedMigrationHash = hashPasswordRandom()

  const bump = (k, n = 1) => {
    inserted[k] = (inserted[k] || 0) + n
  }

  const runSafe = async (step, id, fn) => {
    try {
      await withSavepoint(client, fn)
      return true
    } catch (err) {
      failures.push({ step, id, error: err.message })
      return false
    }
  }

  const tableColumns = await loadPublicTableColumns(client)

  // ---- Fase A: identidade (commit único) ----
  console.log('[import] fase A: roles / users / profiles / empresas / vínculos…')
  await client.query('BEGIN')
  try {
    for (const role of usersFile.roles || []) {
      await client.query(
        `INSERT INTO public.roles (id, roles, created_at)
         VALUES ($1, $2, COALESCE($3::timestamptz, now()))
         ON CONFLICT (id) DO UPDATE SET roles = EXCLUDED.roles`,
        [role.id, role.roles, role.created_at || null],
      )
      bump('roles')
    }

    // NÃO promover profiles.role a partir do papel no vínculo (Admin da empresa ≠ admin da plataforma).
    // profiles.role vem só do export; faltantes → usuario. Superadmin de membership pode
    // elevar profile para superadmin (operadores CF / FocoMEI).
    const membershipSuperadminIds = new Set()
    for (const u of usersFile.users || []) {
      for (const m of u.memberships || []) {
        const roleName = (usersFile.roles || []).find((r) => r.id === m.roles_id)?.roles
        if (mapProfileRole(roleName) === 'superadmin') membershipSuperadminIds.add(u.id)
      }
    }

    const totalUsers = (usersFile.users || []).length
    let userIdx = 0
    for (const u of usersFile.users || []) {
      userIdx += 1
      if (userIdx === 1 || userIdx % 50 === 0 || userIdx === totalUsers) {
        console.log(`[import] users ${userIdx}/${totalUsers}`)
      }
      const meta = {
        ...(u.raw_user_meta_data || {}),
        password_reset_required: true,
        migrated_from: 'meiinfinito',
        migrated_at: new Date().toISOString(),
      }
      const ok = await runSafe('users', u.id, async () => {
        await asideIdentityConflicts(client, {
          keepId: u.id,
          email: u.email,
          phone: u.phone,
        })
        await client.query(
          `INSERT INTO public.users (
             id, email, password_hash, phone, email_confirmed_at,
             raw_user_meta_data, created_at, updated_at, banned_until
           ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,COALESCE($7::timestamptz, now()), now(), $8)
           ON CONFLICT (id) DO UPDATE SET
             email = EXCLUDED.email,
             phone = EXCLUDED.phone,
             email_confirmed_at = COALESCE(EXCLUDED.email_confirmed_at, public.users.email_confirmed_at),
             raw_user_meta_data = public.users.raw_user_meta_data || EXCLUDED.raw_user_meta_data,
             banned_until = EXCLUDED.banned_until,
             deleted_at = NULL,
             updated_at = now()`,
          [
            u.id,
            String(u.email || '').toLowerCase(),
            sharedMigrationHash,
            u.phone || null,
            u.email_confirmed_at || null,
            JSON.stringify(meta),
            u.created_at || null,
            u.banned_until || null,
          ],
        )
      })
      if (ok) bump('users')
    }

    for (const u of usersFile.users || []) {
      let role = 'usuario'
      if (u.profile && !u.profile_missing) {
        role = mapProfileRole(u.profile.role)
      }
      // Só Superadmin no vínculo eleva o profile global (não Admin de escritório).
      if (membershipSuperadminIds.has(u.id)) {
        role = 'superadmin'
      }
      const ok = await runSafe('profiles', u.id, async () => {
        await client.query(
          `INSERT INTO public.profiles (id, role, created_at, last_seen_update_id)
           VALUES ($1, $2, COALESCE($3::timestamptz, now()), $4)
           ON CONFLICT (id) DO UPDATE SET
             role = EXCLUDED.role`,
          [u.id, role, u.profile?.created_at || null, u.profile?.last_seen_update_id || null],
        )
      })
      if (ok) bump('profiles')
    }

    const empresaDirs = listDirs(path.join(root, 'empresas'))
    for (const eid of empresaDirs) {
      const e = readJson(path.join(root, 'empresas', eid, 'empresa.json'))
      const ok = await runSafe('empresas', e.id, async () => {
        await asideEmpresaNameConflict(client, e.id, e.empresa)
        await client.query(
          `INSERT INTO public.empresas (
             id, created_at, empresa, max_mei, max_usuarios_nao_mei, cnpj, razao_social, nome_fantasia,
             inscricao_estadual, regime_tributario, logradouro, numero, complemento, bairro, cidade, estado,
             cep, telefone, email, stripe_customer_id, legacy_mei_slots_pix, status, requested_by
           ) VALUES (
             $1, COALESCE($2::timestamptz, now()), $3, $4, $5, $6, $7, $8,
             $9, $10, $11, $12, $13, $14, $15, $16,
             $17, $18, $19, $20, COALESCE($21, 0), COALESCE($22, 'active'), $23
           )
           ON CONFLICT (id) DO UPDATE SET
             empresa = EXCLUDED.empresa,
             max_mei = EXCLUDED.max_mei,
             cnpj = EXCLUDED.cnpj,
             status = EXCLUDED.status,
             stripe_customer_id = EXCLUDED.stripe_customer_id,
             legacy_mei_slots_pix = EXCLUDED.legacy_mei_slots_pix`,
          [
            e.id,
            e.created_at || null,
            e.empresa,
            e.max_mei ?? null,
            e.max_usuarios_nao_mei ?? null,
            e.cnpj || null,
            e.razao_social || null,
            e.nome_fantasia || null,
            e.inscricao_estadual || null,
            e.regime_tributario || null,
            e.logradouro || null,
            e.numero || null,
            e.complemento || null,
            e.bairro || null,
            e.cidade || null,
            e.estado || null,
            e.cep || null,
            e.telefone || null,
            e.email || null,
            e.stripe_customer_id || null,
            e.legacy_mei_slots_pix ?? 0,
            e.status || 'active',
            e.requested_by || null,
          ],
        )
      })
      if (ok) bump('empresas')
    }

    for (const eid of empresaDirs) {
      const links = readJson(path.join(root, 'empresas', eid, 'memberships.json'))
      for (const l of links || []) {
        const ok = await runSafe('role_x_user_x_empresa', l.id, async () => {
          await client.query(
            `INSERT INTO public.role_x_user_x_empresa (
               id, created_at, user_id, roles_id, empresas_id, status, mei, expires_at
             ) VALUES ($1, COALESCE($2::timestamptz, now()), $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
               status = EXCLUDED.status,
               mei = EXCLUDED.mei,
               roles_id = EXCLUDED.roles_id,
               expires_at = EXCLUDED.expires_at`,
            [
              l.id,
              l.created_at || null,
              l.user_id,
              l.roles_id,
              l.empresas_id,
              l.status,
              l.mei,
              l.expires_at || null,
            ],
          )
        })
        if (ok) bump('role_x_user_x_empresa')
      }

      const subs = readJson(path.join(root, 'empresas', eid, 'subscription_lines.json'))
      for (const s of subs || []) {
        const ok = await runSafe('subscription_lines', s.id, async () => {
          await client.query(
            `INSERT INTO public.empresa_mei_subscription_lines (
               id, empresa_id, mei_slots, status, value_numeric, billing_type, external_reference,
               description, created_at, updated_at, stripe_subscription_id, stripe_checkout_session_id
             ) VALUES (
               $1,$2,$3,$4,$5,$6,$7,
               $8,COALESCE($9::timestamptz, now()), COALESCE($10::timestamptz, now()), $11, $12
             )
             ON CONFLICT (id) DO UPDATE SET
               mei_slots = EXCLUDED.mei_slots,
               status = EXCLUDED.status,
               stripe_subscription_id = EXCLUDED.stripe_subscription_id`,
            [
              s.id,
              s.empresa_id,
              s.mei_slots,
              normalizeSubStatus(s.status),
              s.value_numeric ?? s.value ?? null,
              s.billing_type || null,
              s.external_reference || null,
              s.description || null,
              s.created_at || null,
              s.updated_at || null,
              s.stripe_subscription_id || null,
              s.stripe_checkout_session_id || null,
            ],
          )
        })
        if (ok) bump('empresa_mei_subscription_lines')
      }
    }

    await client.query('COMMIT')
    console.log('[import] fase A commit OK', {
      users: inserted.users || 0,
      empresas: inserted.empresas || 0,
      vinculos: inserted.role_x_user_x_empresa || 0,
      failures: failures.length,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }

  // ---- Fase B: dados por usuário (1 txn cada) ----
  const userDirs = listDirs(path.join(root, 'users'))
  console.log(`[import] fase B: ${userDirs.length} pastas de usuário…`)
  let dirIdx = 0
  for (const uid of userDirs) {
    dirIdx += 1
    if (dirIdx === 1 || dirIdx % 20 === 0 || dirIdx === userDirs.length) {
      console.log(`[import] user-data ${dirIdx}/${userDirs.length} (${uid}) failures=${failures.length}`)
    }
    await client.query('BEGIN')
    try {
      await importUserTables(client, root, uid, { bump, failures, tableColumns, runSafe })
      await importCertificate(client, root, uid, { bump, failures, runSafe })
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      failures.push({ step: 'user_batch', id: uid, error: err.message })
    }
  }
  console.log('[import] fase B concluída')

  // post counts
  const destCounts = await fetchDestCounts(client)
  const expected = manifest.counts || {}
  const countDiffs = []
  for (const key of [
    'empresas',
    'users',
    'vinculos_mei_true',
    'lancamentos_id',
    'mei_nfse',
    'user_mei_certificates',
  ]) {
    const exp = expected[key] ?? expected[key === 'users' ? 'users' : key]
    const got = destCounts[key]
    if (exp != null && got != null && exp !== got) {
      countDiffs.push({ metric: key, expected: exp, destination: got })
    }
  }

  return {
    inserted,
    failures,
    destCounts,
    countDiffs,
    empresas_max_mei_sem_usuarios_mei: dryReport.empresas_max_mei_sem_usuarios_mei,
  }
}

async function withSavepoint (client, fn) {
  const sp = `sp_${crypto.randomBytes(4).toString('hex')}`
  await client.query(`SAVEPOINT ${sp}`)
  try {
    const result = await fn()
    await client.query(`RELEASE SAVEPOINT ${sp}`)
    return result
  } catch (err) {
    await client.query(`ROLLBACK TO SAVEPOINT ${sp}`).catch(() => {})
    throw err
  }
}

/** Libera email/phone de usuário local de teste com UUID diferente do export. */
async function asideIdentityConflicts (client, { keepId, email, phone }) {
  const normalized = String(email || '').toLowerCase().trim()
  if (normalized) {
    const { rows } = await client.query(
      `SELECT id FROM public.users
       WHERE lower(email) = $1 AND id <> $2::uuid`,
      [normalized, keepId],
    )
    for (const r of rows) {
      console.warn(`[import] aside email conflict: ${normalized} (local ${r.id} → keep ${keepId})`)
      await client.query(
        `UPDATE public.users
         SET email = $1, phone = NULL, deleted_at = COALESCE(deleted_at, now()), updated_at = now()
         WHERE id = $2`,
        [`aside+${r.id}@focomei.local`, r.id],
      )
    }
  }
  if (phone) {
    const { rows } = await client.query(
      `SELECT id FROM public.users
       WHERE phone = $1 AND id <> $2::uuid AND deleted_at IS NULL`,
      [String(phone), keepId],
    )
    for (const r of rows) {
      console.warn(`[import] aside phone conflict: ${phone} (local ${r.id})`)
      await client.query(
        `UPDATE public.users SET phone = NULL, updated_at = now() WHERE id = $1`,
        [r.id],
      )
    }
  }
}

async function asideEmpresaNameConflict (client, keepId, nome) {
  const name = String(nome || '').trim()
  if (!name) return
  const { rows } = await client.query(
    `SELECT id FROM public.empresas WHERE empresa = $1 AND id <> $2::uuid`,
    [name, keepId],
  )
  for (const r of rows) {
    console.warn(`[import] aside empresa name conflict: ${name} (local ${r.id})`)
    await client.query(
      `UPDATE public.empresas SET empresa = $1 WHERE id = $2`,
      [`aside-${r.id.slice(0, 8)}-${name}`.slice(0, 120), r.id],
    )
  }
}

async function importUserTables (client, root, uid, { bump, failures, tableColumns, runSafe }) {
  await importJsonRows(client, path.join(root, 'users', uid, 'n8n_link.json'), {
    table: 'n8n_link',
    mode: 'n8n',
    bump,
    failures,
    tableColumns,
    runSafe,
  })

  await importJsonRows(client, path.join(root, 'users', uid, 'categorias_id.json'), {
    table: 'categorias_id',
    mode: 'categorias',
    bump,
    failures,
    tableColumns,
    runSafe,
  })

  for (const table of [
    'contas_financeiras',
    'contas_moeda_global',
    'recorrencias',
    'recorrencia_skips',
    'lancamentos_id',
    'orcamentos',
    'mei_nfse_clientes',
    'mei_nfse_produtos',
    'mei_nfse',
    'mei_nfse_rps_counters',
    'das_mensal_status',
    'das_mei',
    'parcelamento_pdfs',
    'google_tokens_id',
  ]) {
    await importJsonRows(client, path.join(root, 'users', uid, `${table}.json`), {
      table,
      mode: 'uuid_row',
      bump,
      failures,
      tableColumns,
      runSafe,
    })
  }
}

async function importJsonRows (client, filePath, { table, mode, bump, failures, tableColumns, runSafe }) {
  if (!fs.existsSync(filePath)) return
  const rows = readJson(filePath)
  if (!Array.isArray(rows) || !rows.length) return

  for (const row of rows) {
    const ok = await runSafe(table, row.id ?? row.user_id, async () => {
      if (mode === 'n8n') {
        await client.query(
          `INSERT INTO public.n8n_link (user_id, user_number, created_at, updated_at)
           VALUES ($1, $2, COALESCE($3::timestamptz, now()), COALESCE($4::timestamptz, now()))
           ON CONFLICT (user_id) DO UPDATE SET
             user_number = EXCLUDED.user_number,
             updated_at = now()`,
          [row.user_id, row.user_number || null, row.created_at || null, row.updated_at || null],
        )
      } else if (mode === 'categorias') {
        await client.query(
          `INSERT INTO public.categorias_id (id, nome, tipo, cor, criada_em, user_phone, user_id)
           OVERRIDING SYSTEM VALUE
           VALUES ($1,$2,$3,$4,COALESCE($5::timestamp, timezone('America/Sao_Paulo', now())), $6, $7)
           ON CONFLICT (id) DO UPDATE SET
             nome = EXCLUDED.nome,
             tipo = EXCLUDED.tipo,
             cor = EXCLUDED.cor,
             user_id = EXCLUDED.user_id`,
          [
            row.id,
            row.nome,
            normalizeTipo(row.tipo),
            row.cor || null,
            row.criada_em || null,
            row.user_phone ?? null,
            row.user_id,
          ],
        )
      } else if (mode === 'uuid_row') {
        const patched = table === 'lancamentos_id'
          ? { ...row, tipo: normalizeTipo(row.tipo) }
          : row
        await upsertGenericUuidRow(client, table, patched, tableColumns)
      }
    })
    if (ok) bump(table)
  }
}

async function upsertGenericUuidRow (client, table, row, tableColumns) {
  const allowed = tableColumns.get(table)
  if (!allowed?.size) throw new Error(`tabela desconhecida no destino: ${table}`)
  const cols = Object.keys(row).filter((k) => allowed.has(k) && row[k] !== undefined)
  if (!cols.includes('id')) throw new Error(`row sem id em ${table}`)
  const colList = cols.map((c) => `"${c}"`).join(', ')
  const jsonCols = new Set([
    'payload_json',
    'response_json',
    'metadata_json',
    'documentos_ativos',
    'raw_user_meta_data',
  ])
  const castParams = cols.map((c, i) => (jsonCols.has(c) ? `$${i + 1}::jsonb` : `$${i + 1}`)).join(', ')
  const values = cols.map((c) => {
    const v = row[c]
    if (jsonCols.has(c)) return normalizeJsonbValue(v)
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v)
    return v
  })

  await client.query(
    `INSERT INTO public."${table}" (${colList}) VALUES (${castParams})
     ON CONFLICT (id) DO NOTHING`,
    values,
  )
}

async function loadPublicTableColumns (client) {
  const { rows } = await client.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'`,
  )
  const map = new Map()
  for (const r of rows) {
    if (!map.has(r.table_name)) map.set(r.table_name, new Set())
    map.get(r.table_name).add(r.column_name)
  }
  return map
}

async function importCertificate (client, root, uid, { bump, failures, runSafe }) {
  const metaPath = path.join(root, 'users', uid, 'certificate.meta.json')
  if (!fs.existsSync(metaPath)) return
  const metas = readJson(metaPath)
  for (const meta of metas || []) {
    const ok = await runSafe('user_mei_certificates', meta.id, async () => {
      let pfxBase64 = null
      let passphraseEnc = null
      let passphraseIv = null
      const secretPath = path.join(root, 'secrets', 'certificates', `${meta.id}.json`)
      if (fs.existsSync(secretPath)) {
        const secret = readJson(secretPath)
        pfxBase64 = secret.pfx_base64 || null
        passphraseEnc = secret.passphrase_enc || null
        passphraseIv = secret.passphrase_iv || null
        Object.assign(meta, secret.meta || {})
      }

      await client.query(
        `INSERT INTO public.user_mei_certificates (
           id, user_id, pfx_base64, passphrase_enc, passphrase_iv, cert_document,
           created_at, updated_at, cert_valid_from, cert_valid_to, razao_social, nome_fantasia,
           fiscal_email, regime_tributario, inscricao_municipal, cep, logradouro, numero, complemento,
           bairro, ibge_municipio, cidade, uf, optante_simples_nacional, tipo_logradouro,
           documentos_ativos, rps_lote, rps_numero, rps_serie, plugnotas_cert_id, status
         ) VALUES (
           $1,$2,$3,$4,$5,$6,
           COALESCE($7::timestamptz, now()), COALESCE($8::timestamptz, now()), $9, $10, $11, $12,
           $13,$14,$15,$16,$17,$18,$19,
           $20,$21,$22,$23,COALESCE($24, true),$25,
           $26::jsonb,$27,$28,$29,$30,'VALIDO'
         )
         ON CONFLICT (id) DO UPDATE SET
           pfx_base64 = COALESCE(EXCLUDED.pfx_base64, public.user_mei_certificates.pfx_base64),
           passphrase_enc = COALESCE(EXCLUDED.passphrase_enc, public.user_mei_certificates.passphrase_enc),
           passphrase_iv = COALESCE(EXCLUDED.passphrase_iv, public.user_mei_certificates.passphrase_iv),
           updated_at = now(),
           status = 'VALIDO'`,
        [
          meta.id,
          meta.user_id || uid,
          pfxBase64,
          passphraseEnc,
          passphraseIv,
          meta.cert_document || null,
          meta.created_at || null,
          meta.updated_at || null,
          meta.cert_valid_from || null,
          meta.cert_valid_to || null,
          meta.razao_social || null,
          meta.nome_fantasia || null,
          meta.fiscal_email || null,
          meta.regime_tributario || null,
          meta.inscricao_municipal || null,
          meta.cep || null,
          meta.logradouro || null,
          meta.numero || null,
          meta.complemento || null,
          meta.bairro || null,
          meta.ibge_municipio || null,
          meta.cidade || null,
          meta.uf || null,
          meta.optante_simples_nacional ?? true,
          meta.tipo_logradouro || null,
          meta.documentos_ativos ? JSON.stringify(meta.documentos_ativos) : null,
          meta.rps_lote ?? 1,
          meta.rps_numero ?? 1,
          meta.rps_serie || '1',
          meta.plugnotas_cert_id || null,
        ],
      )
    })
    if (ok) bump('user_mei_certificates')
  }
}

async function fetchDestCounts (client) {
  const q = async (sql) => {
    const { rows } = await client.query(sql)
    return Number(rows[0]?.n || 0)
  }
  return {
    empresas: await q('SELECT COUNT(*)::int AS n FROM public.empresas'),
    users: await q('SELECT COUNT(*)::int AS n FROM public.users WHERE deleted_at IS NULL'),
    vinculos_mei_true: await q(
      'SELECT COUNT(*)::int AS n FROM public.role_x_user_x_empresa WHERE mei IS TRUE AND status IS TRUE',
    ),
    lancamentos_id: await q('SELECT COUNT(*)::int AS n FROM public.lancamentos_id'),
    mei_nfse: await q('SELECT COUNT(*)::int AS n FROM public.mei_nfse'),
    user_mei_certificates: await q('SELECT COUNT(*)::int AS n FROM public.user_mei_certificates'),
    profiles: await q('SELECT COUNT(*)::int AS n FROM public.profiles'),
  }
}

function printDryRunReport (report) {
  console.log('\n--- Validação do pacote ---')
  console.log(`ok: ${report.ok}`)
  if (report.errors?.length) {
    console.log('ERROS:')
    for (const e of report.errors.slice(0, 20)) console.log(`  - ${e}`)
  }
  if (report.warnings?.length) {
    console.log('Avisos:')
    for (const w of report.warnings.slice(0, 10)) console.log(`  - ${w}`)
  }
  if (report.diffs?.length) {
    console.log('Diffs manifesto vs arquivos:')
    for (const d of report.diffs) {
      console.log(`  - ${d.label}: expected=${d.expected} found=${d.found}`)
    }
  }
  console.log('\nContagens (amostra):')
  const c = report.counts || {}
  console.log(JSON.stringify({
    empresas: c.empresas_dirs,
    users: c.users_dirs,
    users_mei_true: c.users_mei_true,
    users_without_profile: c.users_without_profile,
    memberships: c.memberships,
    membershipsMei: c.membershipsMei,
    lancamentos_id: c.lancamentos_id,
    mei_nfse: c.mei_nfse,
    certificados: c.user_mei_certificates,
    secrets_pfx: c.secrets_cert_files,
    empresas_max_mei_sem_mei: c.empresas_max_mei_sem_mei,
  }, null, 2))

  console.log('\nMapa roles → profiles.role:')
  for (const r of report.roleMapPreview || []) {
    console.log(`  ${r.export_name} (${r.export_id}) → ${r.profile_role}`)
  }

  console.log('\nPlano de insert:')
  for (const [i, step] of (report.plan || []).entries()) {
    console.log(`  ${i + 1}. ${step}`)
  }

  console.log(`\nEmpresas max_mei sem user mei: ${(report.empresas_max_mei_sem_usuarios_mei || []).length}`)
}

function printApplyReport (applyReport) {
  console.log('\n--- Resultado APPLY ---')
  console.log('inserted keys:', Object.keys(applyReport.inserted || {}).length)
  console.log('failures:', (applyReport.failures || []).length)
  if (applyReport.failures?.length) {
    for (const f of applyReport.failures.slice(0, 15)) {
      console.log(`  - [${f.step}] ${f.id}: ${f.error}`)
    }
  }
  console.log('destCounts:', JSON.stringify(applyReport.destCounts, null, 2))
  console.log('countDiffs:', JSON.stringify(applyReport.countDiffs, null, 2))
}

function writeReportFile (packageDir, report, { applied }) {
  const outDir = path.join(__dirname, 'reports')
  fs.mkdirSync(outDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const file = path.join(outDir, `${applied ? 'apply' : 'dry-run'}-${stamp}.json`)
  // strip any accidental secrets
  const safe = JSON.parse(JSON.stringify(report, (k, v) => {
    if (/passphrase|pfx|password_hash|secret/i.test(String(k))) return undefined
    return v
  }))
  safe.package = packageDir
  safe.applied = applied
  fs.writeFileSync(file, JSON.stringify(safe, null, 2))
  console.log(`\nRelatório: ${file}`)
}

function mapProfileRole (raw) {
  const key = String(raw || 'usuario').trim().toLowerCase()
  return ROLE_NAME_TO_PROFILE[key] || 'usuario'
}

function normalizeSubStatus (status) {
  const s = String(status || 'pending').toLowerCase()
  if (s === 'ativo' || s === 'active' || s === 'trialing') return 'active'
  if (s === 'cancelled' || s === 'canceled' || s === 'cancelado') return 'cancelled'
  return 'pending'
}

function normalizeTipo (tipo) {
  const t = String(tipo || '').toLowerCase()
  if (t === 'saída' || t === 'saida') return 'saida'
  if (t === 'entrada') return 'entrada'
  return t || 'saida'
}

/** Aceita object, JSON string válida, ou string livre → jsonb insert-safe. */
function normalizeJsonbValue (v) {
  if (v == null) return null
  if (typeof v === 'object') return JSON.stringify(v)
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return null
    try {
      JSON.parse(s)
      return s
    } catch {
      return JSON.stringify(s)
    }
  }
  return JSON.stringify(v)
}

function hashPasswordRandom () {
  const password = crypto.randomBytes(32).toString('base64url')
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

function readJson (p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function listDirs (dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((name) => fs.statSync(path.join(dir, name)).isDirectory())
}

function parseArgs (argv) {
  const out = {}
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue
    const eq = raw.indexOf('=')
    if (eq === -1) {
      out[raw.slice(2)] = true
      continue
    }
    out[raw.slice(2, eq)] = raw.slice(eq + 1)
  }
  return out
}

function encodeDbUrlPassword (raw) {
  const m = String(raw).match(/^([^:]+:\/\/[^:]+):([^@]+)@(.+)$/)
  if (!m) return raw
  try {
    return `${m[1]}:${encodeURIComponent(decodeURIComponent(m[2]))}@${m[3]}`
  } catch {
    return `${m[1]}:${encodeURIComponent(m[2])}@${m[3]}`
  }
}
