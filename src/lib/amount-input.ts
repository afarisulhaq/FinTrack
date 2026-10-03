export function formatAmountInput(value: string): string {
  if (!value || value === "-") return value;
  const [integer, fraction] = value.split(".");
  return (
    integer!.replace(/\B(?=(\d{3})+(?!\d))/g, ".") +
    (fraction !== undefined ? `,${fraction}` : "")
  );
}

export function parseAmountInput(value: string): string {
  const cleaned = value.replace(/\./g, "").replace(/[^\d,-]/g, "");
  const negative = cleaned.startsWith("-") ? "-" : "";
  const [integer, ...fractions] = cleaned.replace(/-/g, "").split(",");
  return (
    negative +
    integer!.replace(/^0+(?=\d)/, "") +
    (fractions.length ? `.${fractions.join("")}` : "")
  );
}
