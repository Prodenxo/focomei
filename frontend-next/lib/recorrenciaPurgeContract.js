export function buildRecorrenciaPurgePayload(mode, from) {
  if (mode !== 'future' && mode !== 'all') {
    throw new Error("Modo de exclusão deve ser 'future' ou 'all'.");
  }
  if (mode === 'future') {
    const normalizedFrom = String(from || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedFrom)) {
      throw new Error('Data inicial inválida para excluir lançamentos futuros.');
    }
    return { mode, from: normalizedFrom };
  }
  return { mode };
}
