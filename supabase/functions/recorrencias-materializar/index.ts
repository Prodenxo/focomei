import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Aceita um `ano_mes` opcional no body; padrão = mês atual.
    let anoMes: string
    try {
      const body = await req.json().catch(() => ({}))
      anoMes = body?.ano_mes ?? ''
    } catch {
      anoMes = ''
    }

    if (!anoMes) {
      const now = new Date()
      anoMes = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
    }

    const runKey = `materializar-${anoMes}`
    const db = createClient(supabaseUrl, supabaseServiceKey)

    // Idempotência: aborta se já executou para este mês.
    const { data: existingRun } = await db
      .from('recorrencias_job_runs')
      .select('run_key')
      .eq('run_key', runKey)
      .maybeSingle()

    if (existingRun) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: 'já executado', anoMes }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Registra a execução imediatamente (evita corrida entre instâncias paralelas).
    await db.from('recorrencias_job_runs').insert([{
      run_key: runKey,
      run_type: 'materializar',
      timezone: 'America/Sao_Paulo',
      started_at: new Date().toISOString(),
    }])

    // Busca todas as recorrências ativas.
    const { data: recorrenciasData, error: recErr } = await db
      .from('recorrencias')
      .select('*')
      .eq('ativo', true)

    if (recErr) throw new Error(recErr.message)
    if (!recorrenciasData?.length) {
      return new Response(
        JSON.stringify({ ok: true, materializado: 0, anoMes }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userIds = [...new Set(recorrenciasData.map((rec: any) => rec.user_id).filter(Boolean))]
    const { data: links, error: linksError } = await db
      .from('role_x_user_x_empresa')
      .select('user_id, empresas_id, status, expires_at')
      .in('user_id', userIds)
      .eq('status', true)
    if (linksError) throw new Error(linksError.message)

    const empresaIds = [...new Set((links ?? []).map((link: any) => link.empresas_id).filter(Boolean))]
    const { data: empresas, error: empresasError } = empresaIds.length
      ? await db.from('empresas').select('id, access_status').in('id', empresaIds)
      : { data: [], error: null }
    if (empresasError) throw new Error(empresasError.message)

    const blockedEmpresaIds = new Set(
      (empresas ?? [])
        .filter((empresa: any) => empresa.access_status === 'blocked')
        .map((empresa: any) => empresa.id)
    )
    const now = Date.now()
    const allowedUserIds = new Set(
      (links ?? [])
        .filter((link: any) => {
          if (link.expires_at && new Date(link.expires_at).getTime() <= now) return false
          return !link.empresas_id || !blockedEmpresaIds.has(link.empresas_id)
        })
        .map((link: any) => link.user_id)
    )
    const recorrencias = recorrenciasData.filter((rec: any) => allowedUserIds.has(rec.user_id))
    if (recorrencias.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, materializado: 0, anoMes }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Busca lançamentos já existentes para este mês (por recorrencia_id).
    const recorrenciaIds = recorrencias.map((r: any) => r.id)
    const { data: existentes } = await db
      .from('lancamentos_id')
      .select('recorrencia_id')
      .eq('recorrencia_ano_mes', anoMes)
      .in('recorrencia_id', recorrenciaIds)

    const materialized = new Set((existentes ?? []).map((e: any) => e.recorrencia_id))

    // Determina o dia correto para cada recorrência no mês (respeitando limite do mês).
    const [ano, mesIdx] = anoMes.split('-').map(Number)
    const ultimoDia = new Date(ano, mesIdx, 0).getDate()

    const inserts: any[] = []
    for (const rec of recorrencias) {
      if (materialized.has(rec.id)) continue

      // Respeita max_ocorrencias se configurado.
      const limit: number | null = rec.max_ocorrencias ?? null
      const geradas: number = rec.ocorrencias_geradas ?? 0
      if (limit !== null && geradas >= limit) continue

      const dia = Math.min(rec.dia_do_mes, ultimoDia)
      const data = `${ano}-${pad2(mesIdx)}-${pad2(dia)}`
      const status = rec.tipo === 'entrada' ? 'a_receber' : 'a_pagar'

      inserts.push({
        user_id: rec.user_id,
        data,
        tipo: rec.tipo,
        valor: rec.valor,
        classificacao: rec.classificacao,
        status,
        obs: rec.obs ?? null,
        categoria: rec.categoria ?? null,
        recorrencia_id: rec.id,
        recorrencia_ano_mes: anoMes,
      })
    }

    if (inserts.length > 0) {
      const { error: insErr } = await db.from('lancamentos_id').insert(inserts)
      if (insErr) throw new Error(insErr.message)
    }

    return new Response(
      JSON.stringify({ ok: true, materializado: inserts.length, anoMes }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('[recorrencias-materializar]', err.message)
    return new Response(
      JSON.stringify({ error: err.message ?? 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
