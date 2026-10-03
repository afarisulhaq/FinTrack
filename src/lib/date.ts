export function localDateValue(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseDateValue(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return localDateValue(date) === value ? date : undefined;
}

export function transactionMonth(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : localDateValue(date).slice(0, 7);
}
