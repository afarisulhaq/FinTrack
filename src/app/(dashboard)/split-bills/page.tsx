"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Users,
  X,
  Trash2,
  Check,
  QrCode,
  Receipt,
  ArrowLeft,
  Copy,
  Share2,
  MessageCircle,
  CheckCircle2,
  Link as LinkIcon,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Card, CardBody, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Modal } from "~/components/ui/modal";
import { Badge } from "~/components/ui/badge";
import { QrisModal } from "~/components/qris/qris-modal";
import { useFinanceStore } from "~/store/useFinanceStore";
import { useAppConfigStore } from "~/store/useAppConfigStore";
import { formatCurrency } from "~/lib/utils";
import { buildPayUrl, buildShareText, normalizePhone } from "~/lib/share-utils";
import type { SplitBill, SplitBillParticipant, SplitMethod } from "~/lib/types";

interface DraftParticipant {
  name: string;
  amount: string; // input as string for form control
}

function genLocalId() {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function SplitBillsPage() {
  const splitBills = useFinanceStore((s) => s.splitBills);
  const addSplitBill = useFinanceStore((s) => s.addSplitBill);
  const toggleParticipantPaid = useFinanceStore((s) => s.toggleParticipantPaid);
  const deleteSplitBill = useFinanceStore((s) => s.deleteSplitBill);
  const refreshSplitBills = useFinanceStore((s) => s.refreshSplitBills);
  const qrisStatic = useAppConfigStore((s) => s.config.qrisStatic) ?? "";

  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<SplitBill | null>(null);
  const [qrisFor, setQrisFor] = useState<{
    bill: SplitBill;
    participant: SplitBillParticipant;
  } | null>(null);

  useEffect(() => {
    void refreshSplitBills();
  }, [refreshSplitBills]);

  const active = splitBills.filter((b) => b.status === "active");
  const settled = splitBills.filter((b) => b.status === "settled");

  // Totals span ALL bills (active + settled) so that auto-settling a fully
  // paid bill doesn't make "Sudah Diterima" suddenly read as 0 just because
  // the bill moved sections. The cards describe the user's true cash
  // situation, not the bill list's grouping.
  const totalCollected = splitBills.reduce(
    (s, b) =>
      s +
      b.participants
        .filter((p) => p.paid)
        .reduce((sum, p) => sum + p.amount, 0),
    0,
  );
  const totalOutstanding = active.reduce(
    (s, b) =>
      s +
      b.participants
        .filter((p) => !p.paid)
        .reduce((sum, p) => sum + p.amount, 0),
    0,
  );

  return (
    <PageWrapper
      title="Split Bill"
      subtitle="Bagi tagihan dengan teman, keluarga, atau rekan kerja"
      actions={
        <Button
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setShowCreate(true)}
        >
          Buat Split Bill
        </Button>
      }
    >
      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-text-muted text-xs">Tagihan Aktif</p>
          <p className="text-text-primary mt-1 text-2xl font-bold">
            {active.length}
          </p>
        </Card>
        <Card>
          <p className="text-text-muted text-xs">Total Belum Dibayar</p>
          <p className="text-text-primary mt-1 text-2xl font-bold">
            {formatCurrency(totalOutstanding)}
          </p>
        </Card>
        <Card>
          <p className="text-text-muted text-xs">Sudah Diterima</p>
          <p className="text-success mt-1 text-2xl font-bold">
            {formatCurrency(totalCollected)}
          </p>
        </Card>
      </div>

      {splitBills.length === 0 ? (
        <Card className="text-center">
          <Receipt className="text-text-muted mx-auto mb-2 h-8 w-8" />
          <p className="text-text-muted text-sm">
            Belum ada split bill. Klik "Buat Split Bill" untuk memulai.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {active.length > 0 && (
            <div>
              <h3 className="text-text-muted mb-2 text-xs font-semibold tracking-wider uppercase">
                Aktif
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {active.map((bill) => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    onClick={() => setSelected(bill)}
                  />
                ))}
              </div>
            </div>
          )}
          {settled.length > 0 && (
            <div>
              <h3 className="text-text-muted mb-2 text-xs font-semibold tracking-wider uppercase">
                Selesai
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {settled.map((bill) => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    onClick={() => setSelected(bill)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateSplitBillModal
          onClose={() => setShowCreate(false)}
          onSubmit={async (payload) => {
            await addSplitBill(payload);
            setShowCreate(false);
          }}
        />
      )}

      {selected && (
        <SplitBillDetailModal
          bill={selected}
          qrisStatic={qrisStatic}
          onClose={() => setSelected(null)}
          onTogglePaid={async (participantId, paid) => {
            await toggleParticipantPaid(selected.id, participantId, paid);
            setSelected((current) =>
              current
                ? {
                    ...current,
                    participants: current.participants.map((p) =>
                      p.id === participantId
                        ? {
                            ...p,
                            paid,
                            paidAt: paid ? new Date().toISOString() : undefined,
                          }
                        : p,
                    ),
                  }
                : null,
            );
          }}
          onDelete={async () => {
            await deleteSplitBill(selected.id);
            setSelected(null);
          }}
          onShowQris={(participant) =>
            setQrisFor({ bill: selected, participant })
          }
        />
      )}

      {qrisFor && (
        <QrisModal
          amount={qrisFor.participant.amount}
          staticQris={qrisStatic}
          refId={`SPLIT-${qrisFor.bill.id.slice(-6).toUpperCase()}`}
          participantName={qrisFor.participant.name}
          billTitle={qrisFor.bill.title}
          shareUrl={
            qrisFor.participant.payToken
              ? buildPayUrl(qrisFor.bill.id, qrisFor.participant.payToken)
              : undefined
          }
          whatsappPhone={normalizePhone(qrisFor.participant.contact)}
          onClose={() => setQrisFor(null)}
        />
      )}
    </PageWrapper>
  );
}

// ── Bill Card ─────────────────────────────────────────────────────────────────

function BillCard({ bill, onClick }: { bill: SplitBill; onClick: () => void }) {
  const paidCount = bill.participants.filter((p) => p.paid).length;
  const totalCount = bill.participants.length;
  const collected = bill.participants
    .filter((p) => p.paid)
    .reduce((s, p) => s + p.amount, 0);
  const settled = bill.status === "settled";

  return (
    <button
      onClick={onClick}
      className="bg-bg-surface border-border hover:border-primary/40 rounded-xl border p-4 text-left transition-colors"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-text-primary line-clamp-1 text-sm font-semibold">
          {bill.title}
        </p>
        <Badge variant={settled ? "success" : "warning"} size="sm">
          {settled ? "Selesai" : `${paidCount}/${totalCount}`}
        </Badge>
      </div>
      <p className="text-text-primary text-xl font-bold">
        {formatCurrency(bill.totalAmount)}
      </p>
      <p className="text-text-muted mt-1 text-xs">
        Dibayar oleh {bill.paidBy} ·{" "}
        {new Date(bill.date).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
        })}
      </p>
      <div className="border-border mt-3 flex items-center justify-between border-t pt-2 text-xs">
        <span className="text-text-muted">
          {formatCurrency(collected)} / {formatCurrency(bill.totalAmount)}
        </span>
        <span className="text-text-muted">
          <Users className="mr-1 inline h-3 w-3" />
          {totalCount} orang
        </span>
      </div>
    </button>
  );
}

// ── Create Modal ──────────────────────────────────────────────────────────────

function CreateSplitBillModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (
    payload: Omit<SplitBill, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState<SplitMethod>("equal");
  const [participants, setParticipants] = useState<DraftParticipant[]>([
    { name: "", amount: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  function addParticipant() {
    setParticipants((prev) => [...prev, { name: "", amount: "" }]);
  }

  function removeParticipant(idx: number) {
    setParticipants((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateParticipant(
    idx: number,
    field: "name" | "amount",
    value: string,
  ) {
    setParticipants((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
    );
  }

  function distributeEqually() {
    const total = Number(totalAmount) || 0;
    const n = participants.length;
    if (n === 0 || total === 0) return;
    const each = Math.floor((total / n) * 100) / 100;
    const remainder = Math.round((total - each * n) * 100) / 100;
    setParticipants((prev) =>
      prev.map((p, i) => ({
        ...p,
        amount: i === 0 ? (each + remainder).toString() : each.toString(),
      })),
    );
  }

  const totalInputAmount = participants.reduce(
    (s, p) => s + (Number(p.amount) || 0),
    0,
  );
  const declaredTotal = Number(totalAmount) || 0;
  const amountMismatch =
    declaredTotal > 0 && Math.abs(totalInputAmount - declaredTotal) > 0.01;

  const valid =
    title.trim() &&
    paidBy.trim() &&
    declaredTotal > 0 &&
    participants.every((p) => p.name.trim() && Number(p.amount) > 0);

  async function handleSubmit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        totalAmount: declaredTotal,
        currency: "IDR",
        paidBy: paidBy.trim(),
        date: new Date(date).toISOString(),
        splitMethod: method,
        status: "active",
        participants: participants.map((p) => ({
          id: genLocalId(),
          name: p.name.trim(),
          amount: Number(p.amount),
          paid: false,
        })),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Buat Split Bill"
      description="Bagi tagihan ke beberapa orang"
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Judul"
            placeholder="cth. Makan malam di Resto X"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            label="Dibayar Oleh"
            placeholder="Nama yang bayar dulu"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label="Total Tagihan (Rp)"
            type="number"
            step="any"
            placeholder="0"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
          />
          <Input
            label="Tanggal"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">
              Metode
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as SplitMethod)}
              className="border-border bg-bg-surface text-text-primary focus:ring-primary/50 h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
            >
              <option value="equal">Bagi Rata</option>
              <option value="custom">Nominal Manual</option>
            </select>
          </div>
        </div>
        <Input
          label="Catatan (opsional)"
          placeholder="cth. Termasuk service charge 5%"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-text-secondary text-sm font-medium">
              Peserta ({participants.length})
            </p>
            <div className="flex gap-2">
              {method === "equal" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={distributeEqually}
                  disabled={!declaredTotal}
                >
                  Bagi Rata
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={addParticipant}
              >
                Tambah
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {participants.map((p, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  placeholder="Nama peserta"
                  value={p.name}
                  onChange={(e) =>
                    updateParticipant(idx, "name", e.target.value)
                  }
                />
                <Input
                  type="number"
                  step="any"
                  placeholder="0"
                  value={p.amount}
                  onChange={(e) =>
                    updateParticipant(idx, "amount", e.target.value)
                  }
                />
                {participants.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={() => removeParticipant(idx)}
                    className="text-danger shrink-0 px-3"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {amountMismatch && (
            <p className="text-warning mt-2 text-xs">
              ⚠️ Total peserta ({formatCurrency(totalInputAmount)}) tidak sama
              dengan total tagihan ({formatCurrency(declaredTotal)}). Selisih:{" "}
              {formatCurrency(Math.abs(totalInputAmount - declaredTotal))}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!valid}
            loading={submitting}
            leftIcon={<Check className="h-4 w-4" />}
          >
            Buat
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function SplitBillDetailModal({
  bill,
  qrisStatic,
  onClose,
  onTogglePaid,
  onDelete,
  onShowQris,
}: {
  bill: SplitBill;
  qrisStatic: string;
  onClose: () => void;
  onTogglePaid: (participantId: string, paid: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
  onShowQris: (participant: SplitBillParticipant) => void;
}) {
  const paidCount = bill.participants.filter((p) => p.paid).length;
  const total = bill.participants.length;
  const collected = bill.participants
    .filter((p) => p.paid)
    .reduce((s, p) => s + p.amount, 0);
  const progress = total > 0 ? (paidCount / total) * 100 : 0;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showShare, setShowShare] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title={bill.title}
      description={`${formatCurrency(bill.totalAmount)} · ${new Date(bill.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`}
      size="lg"
    >
      <div className="space-y-4">
        <Card padding="sm">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Dibayar oleh</span>
              <span className="text-text-primary font-medium">
                {bill.paidBy}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Sudah diterima</span>
              <span className="text-success font-semibold">
                {formatCurrency(collected)} / {formatCurrency(bill.totalAmount)}
              </span>
            </div>
            <div className="bg-bg-elevated h-2 overflow-hidden rounded-full">
              <div
                className="bg-success h-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            {bill.description && (
              <p className="text-text-muted text-xs italic">
                {bill.description}
              </p>
            )}
          </div>
        </Card>

        <div>
          <p className="text-text-secondary mb-2 text-sm font-medium">
            Peserta ({paidCount}/{total} lunas)
          </p>
          <div className="space-y-2">
            {bill.participants.map((p) => (
              <div
                key={p.id}
                className={
                  "flex items-center gap-2 rounded-lg border p-2.5 " +
                  (p.paid
                    ? "border-success/30 bg-success/5"
                    : "border-border bg-bg-surface")
                }
              >
                <button
                  type="button"
                  onClick={() => onTogglePaid(p.id, !p.paid)}
                  className={
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors " +
                    (p.paid
                      ? "border-success bg-success"
                      : "border-border hover:border-primary")
                  }
                  aria-label={p.paid ? "Tandai belum lunas" : "Tandai lunas"}
                >
                  {p.paid && <Check className="h-3 w-3 text-white" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={
                      "text-sm font-medium " +
                      (p.paid
                        ? "text-success line-through"
                        : "text-text-primary")
                    }
                  >
                    {p.name}
                  </p>
                  <p className="text-text-muted text-xs">
                    {formatCurrency(p.amount)}
                    {p.paidAt &&
                      ` · lunas ${new Date(p.paidAt).toLocaleDateString("id-ID")}`}
                  </p>
                </div>
                {!p.paid && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onShowQris(p)}
                    disabled={!qrisStatic}
                    leftIcon={<QrCode className="h-3.5 w-3.5" />}
                    title={
                      qrisStatic
                        ? "Tagih via QRIS"
                        : "Atur QRIS statis di Pengaturan dulu"
                    }
                  >
                    Tagih
                  </Button>
                )}
              </div>
            ))}
          </div>
          {!qrisStatic && (
            <p className="text-text-muted mt-2 text-xs">
              💡 Atur QRIS statis kamu di{" "}
              <span className="font-medium">Pengaturan → QRIS</span> untuk bisa
              menagih via QR code.
            </p>
          )}
        </div>

        <div className="border-border flex items-center justify-between border-t pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            className="text-danger hover:bg-danger/10"
            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
          >
            Hapus
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowShare(true)}
              leftIcon={<Share2 className="h-3.5 w-3.5" />}
            >
              Bagikan
            </Button>
            <Button variant="outline" onClick={onClose}>
              Tutup
            </Button>
          </div>
        </div>

        {confirmDelete && (
          <div className="border-danger/30 bg-danger/5 rounded-lg border p-3">
            <p className="text-text-primary text-sm font-medium">
              Hapus split bill ini?
            </p>
            <p className="text-text-muted mt-1 text-xs">
              Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                Batal
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={onDelete}
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              >
                Ya, Hapus
              </Button>
            </div>
          </div>
        )}
      </div>

      {showShare && (
        <ShareSplitBillModal bill={bill} onClose={() => setShowShare(false)} />
      )}
    </Modal>
  );
}

/**
 * Bulk share view: lists every participant with their personal share link
 * and one-tap WhatsApp / copy actions. Shown when the user taps "Bagikan"
 * in the detail modal.
 */
function ShareSplitBillModal({
  bill,
  onClose,
}: {
  bill: SplitBill;
  onClose: () => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const unpaid = bill.participants.filter((p) => !p.paid && p.payToken);

  function shareOne(p: SplitBillParticipant) {
    if (!p.payToken) return;
    const url = buildPayUrl(bill.id, p.payToken);
    const text = buildShareText({
      billTitle: bill.title,
      participantName: p.name,
      amount: formatCurrency(p.amount),
      shareUrl: url,
    });
    const phone = normalizePhone(p.contact);
    const waUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }

  async function copyOne(p: SplitBillParticipant) {
    if (!p.payToken) return;
    const url = buildPayUrl(bill.id, p.payToken);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Bagikan ke Peserta"
      description="Setiap peserta mendapat link unik untuk QRIS & konfirmasi bayar."
      size="md"
    >
      <div className="space-y-3">
        {unpaid.length === 0 ? (
          <div className="border-success/30 bg-success/5 flex items-center gap-2 rounded-lg border p-3 text-sm">
            <CheckCircle2 className="text-success h-4 w-4" />
            <span className="text-text-primary">
              Semua peserta sudah lunas. Tidak ada yang perlu dikirim.
            </span>
          </div>
        ) : (
          unpaid.map((p) => {
            const url = p.payToken ? buildPayUrl(bill.id, p.payToken) : "";
            return (
              <div
                key={p.id}
                className="border-border bg-bg-surface space-y-2 rounded-lg border p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-text-primary truncate text-sm font-semibold">
                      {p.name}
                    </p>
                    <p className="text-text-muted text-xs">
                      {formatCurrency(p.amount)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="success"
                    size="sm"
                    onClick={() => shareOne(p)}
                    className="flex-1"
                    leftIcon={<MessageCircle className="h-3.5 w-3.5" />}
                  >
                    WhatsApp
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyOne(p)}
                    className="flex-1"
                    leftIcon={
                      copiedId === p.id ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <LinkIcon className="h-3.5 w-3.5" />
                      )
                    }
                  >
                    {copiedId === p.id ? "Tersalin" : "Salin Link"}
                  </Button>
                </div>
                {url && (
                  <p className="text-text-muted truncate font-mono text-[10px]">
                    {url}
                  </p>
                )}
              </div>
            );
          })
        )}

        <p className="text-text-muted text-[11px]">
          💡 Klik “Tagih” di daftar peserta untuk lihat QR + opsi kirim
          individual.
        </p>
      </div>
    </Modal>
  );
}
