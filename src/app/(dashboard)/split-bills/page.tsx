"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Plus,
  Users,
  Trash2,
  Check,
  QrCode,
  Receipt,
  Share2,
  MessageCircle,
  CheckCircle2,
  Link as LinkIcon,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Card } from "~/components/ui/card";
import { Button, buttonVariants } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { DatePicker } from "~/components/ui/date-picker";
import { Modal } from "~/components/ui/modal";
import { WalletSelect } from "~/components/ui/wallet-select";
import { Badge } from "~/components/ui/badge";
import { useFinanceStore } from "~/store/useFinanceStore";
import { useAuthStore } from "~/store/useAuthStore";
import { cn, formatCurrency } from "~/lib/utils";
import { buildPayUrl, buildShareText, normalizePhone } from "~/lib/share-utils";
import type { SplitBill, SplitBillParticipant, SplitMethod } from "~/lib/types";
import type { SplitBillListRow, SplitSummary } from "~/lib/people-pages";
import { Pagination } from "~/components/ui/pagination";
import { ServerListStatus } from "~/components/ui/server-paginated-list";
import { useServerPagination } from "~/lib/use-server-pagination";
import { api, type QrisPayment } from "~/lib/api";

interface DraftParticipant {
  name: string;
  amount: string; // input as string for form control
}

function genLocalId() {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function SplitBillsPage() {
  const addSplitBill = useFinanceStore((s) => s.addSplitBill);
  const toggleParticipantPaid = useFinanceStore((s) => s.toggleParticipantPaid);
  const deleteSplitBill = useFinanceStore((s) => s.deleteSplitBill);
  const token = useAuthStore((state) => state.token);

  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<SplitBillListRow | null>(null);
  const [invoiceFor, setInvoiceFor] = useState<{
    bill: SplitBillListRow;
    participant: SplitBillParticipant;
    payment: QrisPayment | null;
    loading: boolean;
    error: string;
  } | null>(null);

  const activePager = useServerPagination<SplitBillListRow, SplitSummary>(
    "/splitBills", { status: "active" }, { resource: "splitBills" },
  );
  const settledPager = useServerPagination<SplitBillListRow, SplitSummary>(
    "/splitBills", { status: "settled" }, { resource: "splitBills" },
  );
  const { totalCollected = 0, totalOutstanding = 0, activeCount = 0 } = activePager.summary ?? {};

  function requestInvoice(
    bill: SplitBillListRow,
    participant: SplitBillParticipant,
  ) {
    const request = { bill, participant };
    setInvoiceFor({
      ...request,
      payment: null,
      loading: true,
      error: "",
    });
    if (!token) {
      setInvoiceFor({
        ...request,
        payment: null,
        loading: false,
        error: "Sesi masuk tidak tersedia. Muat ulang halaman lalu coba lagi.",
      });
      return;
    }
    void api
      .post<QrisPayment>(
        `/split-bills/${encodeURIComponent(bill.id)}/participants/${encodeURIComponent(participant.id)}/qris-invoice`,
        token,
        {},
      )
      .then((payment) =>
        setInvoiceFor((current) =>
          current?.bill.id === bill.id && current.participant.id === participant.id
            ? { ...current, payment, loading: false }
            : current,
        ),
      )
      .catch((cause: unknown) =>
        setInvoiceFor((current) =>
          current?.bill.id === bill.id && current.participant.id === participant.id
            ? {
                ...current,
                loading: false,
                error:
                  cause instanceof Error
                    ? cause.message
                    : "Invoice QRIS gagal dibuat.",
              }
            : current,
        ),
      );
  }

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
            {activeCount}
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

      <ServerListStatus {...activePager} />
      <ServerListStatus {...settledPager} />
      {!activePager.loading && !settledPager.loading && !activePager.error && !settledPager.error && activePager.total + settledPager.total === 0 ? (
        <Card className="text-center">
          <Receipt className="text-text-muted mx-auto mb-2 h-8 w-8" />
          <p className="text-text-muted text-sm">
            Belum ada split bill. Klik "Buat Split Bill" untuk memulai.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {activePager.total > 0 && (
            <div>
              <h3 className="text-text-muted mb-2 text-xs font-semibold tracking-wider uppercase">
                Aktif
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {activePager.items.map((bill) => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    onClick={() => setSelected(bill)}
                  />
                ))}
              </div>
              <Pagination {...activePager} label="split bill aktif" />
            </div>
          )}
          {settledPager.total > 0 && (
            <div>
              <h3 className="text-text-muted mb-2 text-xs font-semibold tracking-wider uppercase">
                Selesai
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {settledPager.items.map((bill) => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    onClick={() => setSelected(bill)}
                  />
                ))}
              </div>
              <Pagination {...settledPager} label="split bill selesai" />
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
          onClose={() => setSelected(null)}
          onTogglePaid={async (participantId, paid, walletId) => {
            await toggleParticipantPaid(
              selected.id,
              participantId,
              paid,
              walletId,
            );
            activePager.reload();
            settledPager.reload();
          }}
          onDelete={async () => {
            await deleteSplitBill(selected.id);
            setSelected(null);
          }}
          onShowQris={(participant) => requestInvoice(selected, participant)}
        />
      )}

      {invoiceFor && (
        <QrisInvoiceModal
          bill={invoiceFor.bill}
          participant={invoiceFor.participant}
          payment={invoiceFor.payment}
          loading={invoiceFor.loading}
          error={invoiceFor.error}
          onClose={() => setInvoiceFor(null)}
          onRetry={() => requestInvoice(invoiceFor.bill, invoiceFor.participant)}
        />
      )}
    </PageWrapper>
  );
}

// ── Bill Card ─────────────────────────────────────────────────────────────────

function BillCard({ bill, onClick }: { bill: SplitBillListRow; onClick: () => void }) {
  const paidCount = bill.paidCount;
  const totalCount = bill.participantCount;
  const collected = bill.collected;
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
      <p className="text-text-primary text-xl font-bold tabular-nums">
        {formatCurrency(bill.totalAmount)}
      </p>
      <p className="text-text-muted mt-1 text-xs">
        Dibayar oleh {bill.paidBy} ·{" "}
        {new Date(bill.date).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
        })}
      </p>
      <div className="border-border mt-3 flex items-center justify-between border-t pt-2 text-xs tabular-nums">
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
  const [walletId, setWalletId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState<SplitMethod>("equal");
  const [participants, setParticipants] = useState<DraftParticipant[]>([
    { name: "", amount: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");

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
    setCreateError("");
    setSubmitting(true);
    try {
      await onSubmit({
        walletId,
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
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "Patungan gagal disimpan. Coba lagi.",
      );
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
            currency
            type="number"
            step="any"
            placeholder="0"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
          />
          <DatePicker label="Tanggal" value={date} onValueChange={setDate} />
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
                  currency
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
            <p className="text-text-warning mt-2 flex items-start gap-1.5 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="tabular-nums">
                Total peserta ({formatCurrency(totalInputAmount)}) tidak sama
                dengan total tagihan ({formatCurrency(declaredTotal)}). Selisih:{" "}
                {formatCurrency(Math.abs(totalInputAmount - declaredTotal))}
              </span>
            </p>
          )}
        </div>

        <WalletSelect
          value={walletId}
          onChange={setWalletId}
          label="Dompet pembayaran awal"
        />
        {createError && (
          <p role="alert" className="text-danger text-sm">
            {createError}
          </p>
        )}
        <p className="text-text-secondary text-xs">
          Saldo dompet berkurang sebesar total tagihan. Pembayaran peserta
          dicatat ke dompet penerima.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!valid || !walletId}
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
  onClose,
  onTogglePaid,
  onDelete,
  onShowQris,
}: {
  bill: SplitBillListRow;
  onClose: () => void;
  onTogglePaid: (
    participantId: string,
    paid: boolean,
    walletId?: string,
  ) => Promise<void>;
  onDelete: () => Promise<void>;
  onShowQris: (participant: SplitBillParticipant) => void;
}) {
  const participantPager = useServerPagination<SplitBillParticipant, SplitBillListRow>(
    "/splitBills", { view: "participants", billId: bill.id },
  );
  const metadata = participantPager.summary ?? bill;
  const paidCount = metadata.paidCount;
  const total = metadata.participantCount;
  const collected = metadata.collected;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [receiptParticipantId, setReceiptParticipantId] = useState<
    string | null
  >(null);
  const [receiptParticipantName, setReceiptParticipantName] = useState("");
  const [receiptWalletId, setReceiptWalletId] = useState("");
  const [paymentError, setPaymentError] = useState("");
  async function togglePaid(participantId: string, paid: boolean, walletId?: string) {
    await onTogglePaid(participantId, paid, walletId);
    participantPager.reload();
  }

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
          <div className="space-y-2 text-sm tabular-nums">
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
          </div>
        </Card>

        <div>
          <p className="text-text-secondary mb-2 text-sm font-medium">
            Peserta ({paidCount}/{total} lunas)
          </p>
          <div className="space-y-2">
            <ServerListStatus {...participantPager} />
            {!participantPager.loading && !participantPager.error && participantPager.total === 0 && (
              <p className="text-text-muted text-sm">Belum ada peserta di patungan ini.</p>
            )}
            {participantPager.items.map((p) => (
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
                  onClick={async () => {
                    setPaymentError("");
                    if (p.paid) {
                      try {
                        await togglePaid(p.id, false);
                      } catch {
                        setPaymentError(
                          "Pembatalan pembayaran gagal. Coba lagi.",
                        );
                      }
                    } else {
                      setReceiptWalletId("");
                      setReceiptParticipantId(p.id);
                      setReceiptParticipantName(p.name);
                    }
                  }}
                  className={
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border-2 transition-colors focus-visible:ring-2 focus-visible:ring-primary " +
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
                {p.paid && !p.walletId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReceiptWalletId("");
                      setReceiptParticipantId(p.id);
                      setReceiptParticipantName(p.name);
                    }}
                  >
                    Catat ke Dompet
                  </Button>
                )}
                {!p.paid && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => onShowQris(p)}
                    leftIcon={<QrCode className="h-3.5 w-3.5" />}
                  >
                    Buat Invoice
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Pagination {...participantPager} label="peserta" />
        </div>

        {receiptParticipantId && (
          <div className="border-border space-y-3 rounded-lg border p-3">
            <p className="text-text-primary text-sm">
              Terima pembayaran dari{" "}
              {receiptParticipantName}
            </p>
            <WalletSelect
              value={receiptWalletId}
              onChange={setReceiptWalletId}
              label="Dompet penerima"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!receiptWalletId}
                onClick={async () => {
                  try {
                    await togglePaid(
                      receiptParticipantId,
                      true,
                      receiptWalletId,
                    );
                    setReceiptParticipantId(null);
                  } catch {
                    setPaymentError("Pembayaran gagal disimpan. Coba lagi.");
                  }
                }}
              >
                Catat Penerimaan
              </Button>
              <Button
                variant="outline"
                onClick={() => setReceiptParticipantId(null)}
              >
                Batal
              </Button>
            </div>
          </div>
        )}
        {paymentError && (
          <p role="alert" className="text-danger text-sm">
            {paymentError}
          </p>
        )}
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
              Patungan dihapus dan seluruh perubahan saldo yang terhubung akan
              dibalik.
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
        <ShareSplitBillModal bill={metadata} onClose={() => setShowShare(false)} />
      )}
    </Modal>
  );
}

function QrisInvoiceModal({
  bill,
  participant,
  payment,
  loading,
  error,
  onClose,
  onRetry,
}: {
  bill: SplitBillListRow;
  participant: SplitBillParticipant;
  payment: QrisPayment | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  const shareUrl = participant.payToken
    ? buildPayUrl(bill.id, participant.payToken)
    : undefined;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Invoice untuk ${participant.name}`}
      description={`${bill.title} · ${formatCurrency(participant.amount)}`}
      size="md"
    >
      {loading ? (
        <div role="status" className="text-text-muted flex flex-col items-center gap-3 py-12 text-sm">
          <Loader2 className="text-primary h-7 w-7 animate-spin" />
          Meminta invoice QRIS dari gateway...
        </div>
      ) : error ? (
        <div role="alert" className="border-danger/30 bg-danger/5 rounded-lg border p-4">
          <p className="text-text-primary font-semibold">Invoice tidak dapat dibuat</p>
          <p className="text-text-muted mt-1 text-sm">{error}</p>
          <p className="text-text-muted mt-2 text-xs">
            Periksa pengaturan QRIS Gateway akun ini, lalu coba lagi.
          </p>
          <Button variant="outline" className="mt-4 min-h-11" onClick={onRetry}>
            Coba lagi
          </Button>
        </div>
      ) : payment ? (
        <div className="space-y-4">
          <div className="border-border bg-bg-elevated rounded-lg border p-4 text-center">
            <p className="text-text-muted text-xs">Total dari gateway</p>
            <p className="text-text-primary mt-1 text-3xl font-bold tabular-nums">
              {formatCurrency(payment.amount)}
            </p>
            <p className="text-text-muted mt-1 text-xs">
              Berlaku sampai {formatGatewayExpiry(payment.expiresAt)}
            </p>
          </div>

          {payment.qrisCode ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-full max-w-[272px] rounded-lg bg-white p-4">
                <QRCodeSVG
                  value={payment.qrisCode}
                  size={240}
                  marginSize={4}
                  className="h-auto w-full"
                  title={`QRIS pembayaran ${formatCurrency(payment.amount)}`}
                />
              </div>
              <p className="text-text-muted max-w-xs text-center text-sm">
                Scan dengan aplikasi bank atau e-wallet. Bayar tepat sesuai
                total dari gateway.
              </p>
            </div>
          ) : payment.checkoutUrl ? (
            <p className="text-text-muted text-center text-sm">
              Gateway menyediakan halaman checkout untuk pembayaran ini.
            </p>
          ) : (
            <div role="status" className="border-warning/30 bg-warning/5 rounded-lg border p-4 text-sm">
              <p className="text-text-primary font-medium">Instruksi pembayaran belum tersedia</p>
              <p className="text-text-muted mt-1">
                Gateway membuat invoice tanpa QR atau halaman checkout. Coba lagi sebelum masa invoice berakhir.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            {payment.checkoutUrl && (
              <a
                href={payment.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "md" }),
                  "min-h-11 flex-1",
                )}
              >
                <ExternalLink className="h-4 w-4" />
                Buka Checkout
              </a>
            )}
            {shareUrl && (
              <CopyParticipantLinkButton shareUrl={shareUrl} />
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function formatGatewayExpiry(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CopyParticipantLinkButton({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setCopyError(false);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <div className="flex-1">
      <Button
        variant="outline"
        className="min-h-11 w-full"
        onClick={() => void copyLink()}
        leftIcon={copied ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
      >
        {copied ? "Link Tersalin" : "Salin Link Peserta"}
      </Button>
      {copyError && (
        <p role="alert" className="text-danger mt-1 text-xs">
          Link gagal disalin. Salin dari kolom alamat browser.
        </p>
      )}
    </div>
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
  bill: SplitBillListRow;
  onClose: () => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const reminderPager = useServerPagination<SplitBillParticipant>(
    "/splitBills", { view: "participants", billId: bill.id, reminders: true },
  );

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
        <ServerListStatus {...reminderPager} />
        {!reminderPager.loading && !reminderPager.error && reminderPager.total === 0 ? (
          <div className="border-success/30 bg-success/5 flex items-center gap-2 rounded-lg border p-3 text-sm">
            <CheckCircle2 className="text-success h-4 w-4" />
            <span className="text-text-primary">
              Semua peserta sudah lunas. Tidak ada yang perlu dikirim.
            </span>
          </div>
        ) : (
          reminderPager.items.map((p) => {
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
        <Pagination {...reminderPager} label="pengingat peserta" />

        <p className="text-text-muted text-[11px]">
          Gunakan “Buat Invoice” pada peserta untuk menampilkan QR atau checkout
          dari gateway.
        </p>
      </div>
    </Modal>
  );
}
