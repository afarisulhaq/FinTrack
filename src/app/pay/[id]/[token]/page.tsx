"use client";

import { Suspense, use, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Loader2,
  QrCode,
  Receipt,
  RefreshCw,
  Wallet,
  ExternalLink,
} from "lucide-react";
import { publicApi, type PublicSplitBill } from "~/lib/api";
import { formatCurrency } from "~/lib/utils";

/**
 * Public participant payment page. Payment instructions come from the
 * owner's gateway invoice and are rendered without handling gateway secrets.
 */
export default function PayPage({
  params,
}: {
  params: Promise<{ id: string; token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="bg-bg-base text-text-primary flex min-h-screen items-center justify-center">
          <Loader2 className="text-primary h-7 w-7 animate-spin" />
        </div>
      }
    >
      <PayPageInner params={params} />
    </Suspense>
  );
}

function PayPageInner({
  params,
}: {
  params: Promise<{ id: string; token: string }>;
}) {
  const { id, token } = use(params);

  const [data, setData] = useState<PublicSplitBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Optimistic local paid state for snappy UX after the user taps the button.
  const [localPaid, setLocalPaid] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const payment = data?.qrisPayment ?? null;
  const paymentExpired = payment
    ? Date.parse(payment.expiresAt) <= Date.now()
    : false;

  async function load(opts?: { silent?: boolean }) {
    if (opts?.silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await publicApi.getSplitBill(id, token);
      setData(result);
      setLocalPaid(result.participant.paid);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat tagihan");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);



  const isPaid = localPaid ?? data?.participant.paid ?? false;

  async function handleTogglePaid() {
    if (!data || toggling) return;
    setToggleError(null);
    setToggling(true);
    const desired = !isPaid;
    // Optimistic update
    setLocalPaid(desired);
    try {
      const result = await publicApi.togglePaid(id, token, desired);
      setLocalPaid(result.paid);
    } catch (e) {
      // Revert
      setLocalPaid(!desired);
      setToggleError(
        e instanceof Error ? e.message : "Gagal memperbarui status",
      );
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="bg-bg-base text-text-primary min-h-screen">
      {/* ─── Top bar ──────────────────────────────────────────────────── */}
      <header className="border-border border-b">
        <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="from-primary to-primary/70 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br shadow-sm">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight">
              {data?.appName ?? "FinTrack"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void load({ silent: true })}
            disabled={refreshing || loading}
            className="text-text-muted hover:text-text-primary focus-visible:ring-primary flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md p-1.5 text-xs transition focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6 sm:py-8">
        {loading ? (
          <LoadingState />
        ) : error || !data ? (
          <ErrorState
            message={error ?? "Tagihan tidak ditemukan"}
            onRetry={() => void load()}
          />
        ) : (
          <div className="space-y-4">
            {/* ─── Bill context card ─────────────────────────────────────── */}
            <section className="border-border bg-bg-surface rounded-2xl border p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="bg-primary/15 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
                  <Receipt className="h-3 w-3" />
                  Split Bill
                </span>
                <span className="text-text-muted text-[10px]">
                  {formatDate(data.date)}
                </span>
              </div>
              <h1 className="text-text-primary text-xl leading-tight font-bold">
                {data.title}
              </h1>
              {data.description && (
                <p className="text-text-muted mt-1 text-sm">
                  {data.description}
                </p>
              )}
              <div className="text-text-muted mt-3 flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <Wallet className="h-3 w-3" />
                  Dibayar {data.paidBy}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {data.meta.paidCount}/{data.meta.participantCount} lunas
                </span>
              </div>
            </section>

            {/* ─── My amount card ────────────────────────────────────────── */}
            <section className="from-primary/15 to-primary/5 border-primary/20 rounded-2xl border bg-gradient-to-br p-5 text-center">
              <p className="text-text-muted text-xs">Tagihan untuk</p>
              <p className="text-text-primary mt-0.5 text-lg font-semibold">
                {data.participant.name}
              </p>
              <p className="text-text-primary mt-3 text-4xl font-extrabold tracking-tight tabular-nums">
                {formatCurrency(data.participant.amount)}
              </p>
              <p className="text-text-muted mt-1 text-xs tabular-nums">
                dari total {formatCurrency(data.totalAmount)}
              </p>
            </section>

            {/* ─── QR code card ──────────────────────────────────────────── */}
            <section className="border-border bg-bg-surface rounded-2xl border p-5">
              {payment ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-text-muted text-xs">Total pembayaran</p>
                    <p className="text-text-primary mt-1 text-3xl font-bold tabular-nums">
                      {formatCurrency(payment.amount)}
                    </p>
                    <p className={paymentExpired ? "text-danger mt-1 text-xs" : "text-text-muted mt-1 text-xs"}>
                      {paymentExpired ? "Invoice ini sudah kedaluwarsa" : `Berlaku sampai ${formatDateTime(payment.expiresAt)}`}
                    </p>
                  </div>
                  {payment.qrisCode && !paymentExpired && (
                    <>
                      <div className="flex justify-center">
                        <div className="w-full max-w-[252px] rounded-xl bg-white p-4">
                          <QRCodeSVG
                            value={payment.qrisCode}
                            size={220}
                            marginSize={4}
                            className="h-auto w-full"
                            title={`QRIS pembayaran ${formatCurrency(payment.amount)}`}
                          />
                        </div>
                      </div>
                      <p className="text-text-muted text-center text-xs">
                        Scan dengan aplikasi bank atau e-wallet. Pastikan total
                        yang tampil sama sebelum membayar.
                      </p>
                    </>
                  )}
                  {payment.checkoutUrl && !paymentExpired && (
                    <a
                      href={payment.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-border bg-bg-surface text-text-primary hover:bg-bg-elevated focus-visible:ring-primary flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Buka Halaman Pembayaran
                    </a>
                  )}
                  {paymentExpired ? (
                    <div role="alert" className="border-danger/30 bg-danger/5 rounded-lg border p-3 text-sm">
                      <p className="text-text-primary font-semibold">Jangan bayar invoice ini</p>
                      <p className="text-text-muted mt-1 text-xs">
                        Minta pihak yang menagih membuat invoice QRIS baru.
                      </p>
                    </div>
                  ) : !payment.qrisCode && !payment.checkoutUrl ? (
                    <div role="status" className="border-warning/30 bg-warning/5 rounded-lg border p-3 text-sm">
                      <p className="text-text-primary font-semibold">
                        Instruksi pembayaran belum tersedia
                      </p>
                      <p className="text-text-muted mt-1 text-xs">
                        Minta pihak yang menagih membuat ulang invoice QRIS.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div role="status" className="border-warning/30 bg-warning/5 flex items-start gap-3 rounded-lg border p-3 text-left">
                  <AlertCircle className="text-warning h-5 w-5 shrink-0" />
                  <div className="text-xs">
                    <p className="text-text-primary font-semibold">
                      Invoice QRIS belum tersedia
                    </p>
                    <p className="text-text-muted mt-1">
                      Pihak yang menagih perlu membuat invoice dari daftar
                      peserta sebelum pembayaran dapat dilakukan.
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* ─── Paid toggle ───────────────────────────────────────────── */}
            <section
              className={`rounded-2xl border p-4 transition-colors ${
                isPaid
                  ? "border-success/30 bg-success/5"
                  : "border-border bg-bg-surface"
              }`}
            >
              <div className="flex items-start gap-3">
                {isPaid ? (
                  <CheckCircle2 className="text-success mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <QrCode className="text-text-muted mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold ${
                      isPaid ? "text-success" : "text-text-primary"
                    }`}
                  >
                    {isPaid ? "Pembayaran dikonfirmasi" : "Sudah bayar?"}
                  </p>
                  <p className="text-text-muted mt-0.5 text-xs">
                    {isPaid
                      ? data.participant.paidAt
                        ? `Dikonfirmasi ${formatDate(data.participant.paidAt)}`
                        : "Terima kasih!"
                      : "Setelah bayar, tekan tombol di bawah supaya yang menagih tahu."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTogglePaid}
                disabled={toggling}
                className={`mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:opacity-60 ${
                  isPaid
                    ? "bg-bg-elevated text-text-secondary hover:bg-bg-elevated/70"
                    : "bg-success hover:bg-success/90 text-white"
                }`}
              >
                {toggling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPaid ? (
                  "Batalkan Konfirmasi"
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Tandai Sudah Bayar
                  </>
                )}
              </button>
              {toggleError && (
                <p className="text-danger mt-2 text-xs">{toggleError}</p>
              )}
            </section>

            <footer className="text-text-muted pt-2 text-center text-[11px]">
              Periksa judul tagihan dan total dari gateway sebelum membayar.
            </footer>
          </div>
        )}
      </main>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-3 py-16">
      <Loader2 className="text-primary h-7 w-7 animate-spin" />
      <p role="status" className="text-text-muted text-sm">Memuat tagihan...</p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="border-danger/30 bg-danger/5 flex flex-col items-center gap-3 rounded-2xl border p-8 text-center">
      <AlertCircle className="text-danger h-8 w-8" />
      <div>
        <p className="text-text-primary text-base font-semibold">
          Tagihan tidak bisa dibuka
        </p>
        <p className="text-text-muted mt-1 text-sm">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="bg-bg-elevated text-text-primary hover:bg-bg-elevated/70 focus-visible:ring-primary min-h-11 rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:outline-none"
      >
        Coba Lagi
      </button>
    </div>
  );
}

function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
