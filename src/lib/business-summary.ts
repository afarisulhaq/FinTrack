export function businessSummary(entries: { type: string; amount: number }[]) {
  const income = entries
    .filter((entry) => entry.type === "income")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const expense = entries
    .filter((entry) => entry.type === "expense")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const difference = income - expense;
  return {
    income,
    expense,
    difference,
    returnPercent: expense > 0 ? (difference / expense) * 100 : null,
  };
}

export function formatBusinessReturn(value: number | null) {
  return value === null
    ? "Belum dapat dihitung"
    : `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)}%`;
}
