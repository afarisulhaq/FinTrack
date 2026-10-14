import { randomUUID } from "node:crypto";
import {
  readWalletEffects,
  reconcileWalletEffects,
  type WalletEffect,
} from "./wallet-effects.js";

function positive(value: unknown, label: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error(`${label} harus lebih dari nol`);
  return amount;
}

function fee(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0)
    throw new Error("Fee harus berupa nominal positif atau nol");
  return amount;
}

async function validateWallet(
  client: any,
  walletId: string | null,
  scope: string | null,
  currency: string,
) {
  if (!walletId) return;
  const wallet = await client.wallet.findFirst({
    where: { id: walletId, ...(scope ? { userId: scope } : {}) },
  });
  if (!wallet) throw new Error("Dompet investasi tidak tersedia");
  if (wallet.currency !== currency || currency !== "IDR")
    throw new Error("Dompet investasi harus menggunakan Rupiah");
}

export async function createInvestment(
  client: any,
  input: any,
  userId: string | null,
  scope: string | null,
  restore: boolean,
) {
  const data = {
    ...input,
    userId,
    soldQuantity: restore ? input.soldQuantity : 0,
  };
  await validateWallet(client, data.walletId, scope, data.currency);
  if (restore)
    return client.investment.create({ data: { ...data, walletEffects: [] } });
  positive(data.quantity, "Jumlah beli");
  positive(data.avgBuyPrice, "Harga beli");
  data.buyFee = fee(data.buyFee);
  await client.$queryRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1))::text",
    JSON.stringify([
      userId,
      data.broker,
      data.symbol,
      data.assetClass,
      data.walletId,
    ]),
  );
  let existing = await client.investment.findFirst({
    where: {
      userId,
      broker: data.broker,
      symbol: data.symbol,
      assetClass: data.assetClass,
      walletId: data.walletId,
      quantity: { gt: 0 },
    },
  });
  if (existing) {
    await client.$queryRawUnsafe(
      'SELECT "id" FROM "Investment" WHERE "id" = $1 FOR UPDATE',
      existing.id,
    );
    existing = await client.investment.findFirst({
      where: { id: existing.id, quantity: { gt: 0 } },
    });
  }
  const previous = readWalletEffects(existing?.walletEffects);
  const debit = data.quantity * data.avgBuyPrice + data.buyFee;
  const effects: WalletEffect[] = data.walletId
    ? [
        ...previous.filter((effect) => effect.key !== "buy"),
        {
          key: "buy",
          walletId: data.walletId,
          amount:
            (previous.find((effect) => effect.key === "buy")?.amount ?? 0) -
            debit,
        },
      ]
    : previous;
  await reconcileWalletEffects(client, previous, effects, scope);
  if (!existing)
    return client.investment.create({
      data: { ...data, walletEffects: effects },
    });
  const quantity = Number(existing.quantity) + data.quantity;
  return client.investment.update({
    where: { id: existing.id },
    data: {
      name: data.name || existing.name,
      quantity,
      avgBuyPrice:
        (Number(existing.quantity) * Number(existing.avgBuyPrice) +
          data.quantity * data.avgBuyPrice) /
        quantity,
      currentPrice: data.currentPrice || existing.currentPrice,
      currency: data.currency,
      color: data.color,
      buyFee: Number(existing.buyFee ?? 0) + data.buyFee,
      walletEffects: effects,
    },
  });
}

export async function updateInvestment(
  client: any,
  resourceId: string,
  body: any,
  normalized: any,
  scope: string | null,
) {
  await client.$queryRawUnsafe(
    'SELECT "id" FROM "Investment" WHERE "id" = $1 FOR UPDATE',
    resourceId,
  );
  const existing = await client.investment.findFirst({
    where: { id: resourceId, ...(scope ? { userId: scope } : {}) },
  });
  if (!existing) throw new Error("Data tidak ditemukan");
  const data: any = {};
  for (const key of Object.keys(normalized)) {
    if (body[key] !== undefined && key !== "soldQuantity")
      data[key] = normalized[key];
  }
  const previous = readWalletEffects(existing.walletEffects);
  let effects = [...previous];
  const held = Number(existing.quantity);
  const sold = Number(existing.soldQuantity ?? 0);
  const walletId =
    body.walletId === undefined ? existing.walletId : normalized.walletId;
  if (walletId !== existing.walletId && sold > 0)
    throw new Error("Dompet sumber tidak dapat diganti setelah penjualan");
  await validateWallet(
    client,
    walletId,
    scope,
    data.currency ?? existing.currency,
  );
  if (body.sellPrice !== undefined && body.sellPrice !== null) {
    const price = positive(body.sellPrice, "Harga jual");
    const quantity = positive(body.sellQuantity ?? held, "Jumlah jual");
    if (quantity > held)
      throw new Error("Jumlah jual melebihi jumlah dimiliki");
    const sellFee = fee(body.sellFee);
    if (sellFee > price * quantity) throw new Error("Fee melebihi nilai jual");
    const destination =
      body.sellWalletId === undefined ? walletId : body.sellWalletId || null;
    await validateWallet(
      client,
      destination,
      scope,
      data.currency ?? existing.currency,
    );
    if (destination)
      effects.push({
        key: `sell:${randomUUID()}`,
        walletId: destination,
        amount: price * quantity - sellFee,
      });
    data.quantity = held - quantity;
    data.soldQuantity = sold + quantity;
    data.sellPrice = price;
    data.sellFee = sellFee;
  } else if (body.sellPrice === null && sold > 0) {
    data.quantity = held + sold;
    data.soldQuantity = 0;
    effects = effects.filter((effect) => !effect.key.startsWith("sell:"));
  } else if (
    body.quantity !== undefined ||
    body.avgBuyPrice !== undefined ||
    body.buyFee !== undefined ||
    body.walletId !== undefined
  ) {
    const quantity = Number(data.quantity ?? held);
    if (!Number.isFinite(quantity) || quantity < 0 || quantity + sold <= 0)
      throw new Error("Jumlah investasi tidak valid");
    const price = positive(
      data.avgBuyPrice ?? existing.avgBuyPrice,
      "Harga beli",
    );
    const buyFee = fee(data.buyFee ?? existing.buyFee);
    const oldBuy = effects.find((effect) => effect.key === "buy");
    effects = effects.filter((effect) => effect.key !== "buy");
    if (walletId && (oldBuy || body.walletId !== undefined)) {
      const oldCost =
        (held + sold) * Number(existing.avgBuyPrice) +
        Number(existing.buyFee ?? 0);
      const newCost = (quantity + sold) * price + buyFee;
      effects.push({
        key: "buy",
        walletId,
        amount:
          oldBuy && walletId === existing.walletId
            ? oldBuy.amount - (newCost - oldCost)
            : -newCost,
      });
    }
  }
  await reconcileWalletEffects(client, previous, effects, scope);
  return client.investment.update({
    where: { id: resourceId },
    data: { ...data, walletEffects: effects },
  });
}

export async function deleteInvestment(
  client: any,
  resourceId: string,
  scope: string | null,
) {
  await client.$queryRawUnsafe(
    'SELECT "id" FROM "Investment" WHERE "id" = $1 FOR UPDATE',
    resourceId,
  );
  const existing = await client.investment.findFirst({
    where: { id: resourceId, ...(scope ? { userId: scope } : {}) },
  });
  if (!existing) throw new Error("Data tidak ditemukan");
  await reconcileWalletEffects(client, existing.walletEffects, [], scope);
  await client.investment.delete({ where: { id: resourceId } });
}
