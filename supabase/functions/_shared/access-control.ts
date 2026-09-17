type SupabaseClientLike = {
  rpc: (...args: any[]) => any
}

export async function assertCurrentAccess(
  client: SupabaseClientLike,
  responseHeaders: Record<string, string> = {},
): Promise<Response | null> {
  const { data, error } = await client.rpc('current_access_denial_code')
  if (error) {
    console.error('[access-control] falha ao validar acesso', error.message)
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Não foi possível validar seu acesso. Tente novamente.',
        errors: { code: 'ACCESS_VALIDATION_UNAVAILABLE' },
      }),
      { status: 503, headers: { ...responseHeaders, 'Content-Type': 'application/json' } },
    )
  }
  if (data == null) return null
  const code = data === 'PROFILE_BLOCKED' ? 'PROFILE_BLOCKED' : 'OFFICE_BLOCKED'
  const message = code === 'PROFILE_BLOCKED'
    ? 'Seu perfil está bloqueado. Entre em contato com o responsável.'
    : 'O acesso a este escritório está suspenso. Entre em contato com o responsável.'
  return new Response(
    JSON.stringify({
      success: false,
      message,
      errors: { code },
    }),
    { status: 403, headers: { ...responseHeaders, 'Content-Type': 'application/json' } },
  )
}
