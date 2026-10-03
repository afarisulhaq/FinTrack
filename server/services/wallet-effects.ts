export interface WalletEffect {
  key: string;
  walletId: string;
  amount: number;
}

export function readWalletEffects(value: unknown): WalletEffect[] {
  return Array.isArray(value) ? (value as WalletEffect[]) : [];
}

export async function reconcileWalletEffects(
  client: any,
  previous: unknown,
  next: WalletEffect[],
  userId: string | null,
) {
  const deltas = new Map<string, number>();
  for (const effect of readWalletEffects(previous))
    deltas.set(
      effect.walletId,
      (deltas.get(effect.walletId) ?? 0) - Number(effect.amount),
    );
  for (const effect of next) {
    if (!effect.walletId || !Number.isFinite(effect.amount))
      throw new Error("Dompet dan nominal pembayaran tidak valid");
    deltas.set(
      effect.walletId,
      (deltas.get(effect.walletId) ?? 0) + effect.amount,
    );
  }
  for (const [walletId, delta] of [...deltas.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const wallet = await client.wallet.findFirst({
      where: { id: walletId, ...(userId ? { userId } : {}) },
    });
    if (!wallet) throw new Error("Dompet pembayaran tidak tersedia");
    if (wallet.currency !== "IDR")
      throw new Error("Pembayaran ini memerlukan dompet Rupiah");
    if (delta === 0) continue;
    await client.wallet.update({
      where: { id: walletId },
      data: { balance: { increment: delta } },
    });
  }
}

export function debtWalletEffects(debt: any): WalletEffect[] {
  const effects: WalletEffect[] = [];
  if (debt.walletId)
    effects.push({
      key: "principal",
      walletId: debt.walletId,
      amount: Number(debt.amount) * (debt.direction === "owe" ? 1 : -1),
    });
  for (const installment of debt.installments ?? []) {
    if (!installment.walletId) continue;
    if (
      !Number.isFinite(Number(installment.amount)) ||
      Number(installment.amount) <= 0
    )
      throw new Error("Nominal cicilan harus lebih dari nol");
    effects.push({
      key: installment.id,
      walletId: installment.walletId,
      amount: Number(installment.amount) * (debt.direction === "owe" ? -1 : 1),
    });
  }
  return effects;
}

export function resourceWalletUpdate(
  resource: "bills" | "savingGoals" | "debts",
  previous: any,
  changes: any,
) {
  const {
    walletEffects: _ignored,
    contributionAmount,
    contributionId,
    sourceWalletId,
    ...data
  } = changes;
  const merged = { ...previous, ...data };
  if (
    (resource === "bills" || resource === "debts") &&
    (!Number.isFinite(Number(merged.amount)) || Number(merged.amount) <= 0)
  )
    throw new Error("Nominal harus lebih dari nol");
  let effects = readWalletEffects(previous?.walletEffects);
  if (resource === "bills") {
    if (
      merged.status === "paid" &&
      !merged.walletId &&
      previous?.status !== "paid"
    )
      throw new Error("Pilih dompet pembayaran tagihan");
    effects =
      merged.status === "paid" && merged.walletId
        ? [
            {
              key: "payment",
              walletId: merged.walletId,
              amount: -Number(merged.amount),
            },
          ]
        : [];
  }
  if (resource === "debts") {
    if (!["owe", "lent"].includes(merged.direction))
      throw new Error("Jenis utang tidak valid");
    const oldInstallments = previous?.installments ?? [];
    for (const installment of merged.installments ?? []) {
      if (
        !oldInstallments.some((old: any) => old.id === installment.id) &&
        !installment.walletId
      )
        throw new Error("Pilih dompet untuk cicilan");
    }
    effects = debtWalletEffects(merged);
  }
  if (resource === "savingGoals" && contributionAmount !== undefined) {
    const amount = Number(contributionAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !contributionId)
      throw new Error("Nominal tabungan tidak valid");
    if (
      !sourceWalletId ||
      !merged.walletId ||
      sourceWalletId === merged.walletId
    )
      throw new Error("Pilih dompet sumber dan dompet tabungan yang berbeda");
    if (!effects.some((effect) => effect.key === `${contributionId}:out`)) {
      effects = [
        ...effects,
        {
          key: `${contributionId}:out`,
          walletId: sourceWalletId,
          amount: -amount,
        },
        { key: `${contributionId}:in`, walletId: merged.walletId, amount },
      ];
      data.currentAmount = Number(previous?.currentAmount ?? 0) + amount;
    } else data.currentAmount = Number(previous.currentAmount);
  }
  return { ...data, walletEffects: effects };
}

export async function lockFinanceRecord(
  client: any,
  resource: "bills" | "savingGoals" | "debts" | "splitBills",
  id: string,
) {
  const tables = {
    bills: "Bill",
    savingGoals: "SavingGoal",
    debts: "Debt",
    splitBills: "SplitBill",
  };
  await client.$queryRawUnsafe(
    `SELECT "id" FROM "${tables[resource]}" WHERE "id" = $1 FOR UPDATE`,
    id,
  );
}
