/** Porte fiel de `frontend/lib/transactionPeriodFilter.ts`. */

export function parseTransactionDate(t) {
  const raw = t.data ? String(t.data).slice(0, 10) : '';
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T12:00:00`);
  }
  if (t.criado_em) return new Date(t.criado_em);
  return new Date();
}

export function isInCurrentWeek(date) {
  const now = new Date();
  const day = now.getDay();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  firstDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(firstDay);
  lastDay.setDate(firstDay.getDate() + 6);
  lastDay.setHours(23, 59, 59, 999);
  return date >= firstDay && date <= lastDay;
}

export function isTodayDate(date) {
  const now = new Date();
  return (
    date.getDate() === now.getDate()
    && date.getMonth() === now.getMonth()
    && date.getFullYear() === now.getFullYear()
  );
}

export function isInSelectedMonth(t, selectedMonth) {
  const data = parseTransactionDate(t);
  return (
    data.getMonth() === selectedMonth.month - 1
    && data.getFullYear() === selectedMonth.year
  );
}
