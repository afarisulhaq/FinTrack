import {
  lockFinanceRecord,
  readWalletEffects,
  reconcileWalletEffects,
} from "./wallet-effects.js";

export async function toggleSplitWalletPayment(
  client: any,
  billId: string,
  participantId: string,
  paid: boolean,
  walletId: string | undefined,
  userId: string | null,
  publicPayment = false,
) {
  await lockFinanceRecord(client, "splitBills", billId);
  const bill = await client.splitBill.findFirst({
    where: { id: billId, ...(userId ? { userId } : {}) },
    include: { participants: true },
  });
  if (!bill) throw new Error("Patungan tidak ditemukan");
  const participant = bill.participants.find(
    (item: any) => item.id === participantId,
  );
  if (!participant)
    throw new Error("Peserta tidak ditemukan dalam patungan ini");
  if (
    !Number.isFinite(Number(participant.amount)) ||
    Number(participant.amount) <= 0
  )
    throw new Error("Nominal peserta tidak valid");
  if (bill.status === "cancelled") throw new Error("Patungan sudah dibatalkan");
  if (paid && !publicPayment && !walletId)
    throw new Error("Pilih dompet penerima pembayaran");
  const effects = paid
    ? publicPayment
      ? readWalletEffects(participant.walletEffects)
      : [
          {
            key: "receipt",
            walletId: walletId!,
            amount: Number(participant.amount),
          },
        ]
    : [];
  await reconcileWalletEffects(
    client,
    participant.walletEffects,
    effects,
    bill.userId,
  );
  const updated = await client.splitBillParticipant.update({
    where: { id: participantId },
    data: {
      paid,
      paidAt: paid ? (participant.paidAt ?? new Date()) : null,
      walletId: publicPayment ? participant.walletId : paid ? walletId : null,
      walletEffects: effects,
    },
  });
  const allPaid = bill.participants.every((item: any) =>
    item.id === participantId ? paid : item.paid,
  );
  await client.splitBill.update({
    where: { id: billId },
    data: { status: allPaid ? "settled" : "active" },
  });
  return updated;
}
