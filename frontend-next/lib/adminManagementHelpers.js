const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function filterAdminEmpresas(empresas, users, filters = {}) {
  const search = normalize(filters.search);
  const access = filters.access || 'all';
  const mei = filters.mei || 'all';

  return [...(empresas || [])]
    .filter((empresa) => {
      const members = (users || []).filter((user) => user.empresaId === empresa.id);
      const haystack = normalize([
        empresa.empresa,
        empresa.nome_fantasia,
        empresa.razao_social,
        empresa.cnpj,
        ...members.flatMap((user) => [user.displayName, user.email]),
      ].filter(Boolean).join(' '));
      const maxMei = Number(empresa.max_mei) || 0;
      if (search && !haystack.includes(search)) return false;
      if (access === 'active' && empresa.access_status === 'blocked') return false;
      if (access === 'blocked' && empresa.access_status !== 'blocked') return false;
      if (mei === 'active' && maxMei <= 0) return false;
      if (mei === 'inactive' && maxMei > 0) return false;
      return true;
    })
    .sort((a, b) =>
      String(a.nome_fantasia || a.empresa || '').localeCompare(
        String(b.nome_fantasia || b.empresa || ''),
        'pt-BR',
        { sensitivity: 'base' },
      ));
}

export function listEmpresaMembers(users, empresaId) {
  return (users || [])
    .filter((user) => user.empresaId === empresaId)
    .sort((a, b) =>
      String(a.displayName || a.email || '').localeCompare(
        String(b.displayName || b.email || ''),
        'pt-BR',
        { sensitivity: 'base' },
      ));
}

export function normalizeCpf(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

export function isValidCpf(value) {
  const digits = normalizeCpf(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const calculate = (length) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calculate(9) === Number(digits[9]) && calculate(10) === Number(digits[10]);
}

export function mapStripeReturn(searchParams) {
  const status = searchParams?.get?.('stripe_mei') || '';
  const checkoutSessionId = searchParams?.get?.('session_id') || '';
  if (status !== 'success' && status !== 'cancel') return null;
  return { status, checkoutSessionId: checkoutSessionId.trim() || null };
}
