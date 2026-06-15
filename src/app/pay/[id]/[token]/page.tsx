"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { publicApi, type PublicSplitBill } from "~/lib/api";
import { isValidQrisShape, toDynamicQris } from "~/lib/qris-utils";
import { formatCurrency } from "~/lib/utils";

/**
 * Public pay page — no auth required.
 *
 * Route: /pay/{billId}/{participantToken}
 *
 * Flow:
 *  1. Page loads, fetches the public bill context.
 *  2. Renders a dynamic QRIS code with the bill title as merchant name.
 *  3. User scans with their e-wallet, pays, then taps "Tandai Sudah Bayar".
 *  4. The PUT to /public/split-bills/:id/:token/pay flips the paid flag.
 *
 * Designed mobile-first since 90% of recipients open it on a phone.
 *
 * Add `?debug=1` to the URL to see the raw `staticQris` payload coming
 * from the server — useful when the QR doesn't render.
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
  const searchParams = useSearchParams();
  const debug = searchParams.get("debug") === "1";

  const [data, setData] = useState<PublicSplitBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Optimistic local paid state for snappy UX after the user taps the button.
  const [localPaid, setLocalPaid] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

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

  const dynamicQris = useMemo(() => {
    if (!data?.staticQris) return null;
    if (!isValidQrisShape(data.staticQris)) return null;
    try {
      return toDynamicQris(
        data.staticQris,
        data.participant.amount,
        `SPLIT-${data.billId.slice(-6).toUpperCase()}`,
        { merchantName: data.title },
      ).payload;
    } catch {
      return null;
    }
  }, [data]);

  // Diagnostic: why is the QR not available?
  const qrisDiagnostic = useMemo(() => {
    if (!data) return null;
    if (!data.staticQris) {
      return {
        reason: "Server tidak mengembalikan staticQris",
        detail: "AppSetting.qrisStatic kosong di database & in-memory store.",
      } as const;
    }
    if (!isValidQrisShape(data.staticQris)) {
      return {
        reason: "Format QRIS tidak valid",
        detail: `Panjang ${data.staticQris.length}, harus ≥20, mulai dengan "00", diakhiri "...63" dalam 8 karakter terakhir.`,
      } as const;
    }
    return null;
  }, [data]);

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
            className="text-text-muted hover:text-text-primary flex items-center gap-1 rounded-md p-1.5 text-xs transition disabled:opacity-40"
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
              <p className="text-text-primary mt-3 text-4xl font-extrabold tracking-tight">
                {formatCurrency(data.participant.amount)}
              </p>
              <p className="text-text-muted mt-1 text-xs">
                dari total {formatCurrency(data.totalAmount)}
              </p>
            </section>

            {/* ─── QR code card ──────────────────────────────────────────── */}
            <section className="border-border bg-bg-surface rounded-2xl border p-5">
              {dynamicQris ? (
                <>
                  <div className="flex justify-center">
                    <div className="rounded-xl bg-white p-4">
                      <QRCodeSVG
                        value={dynamicQris}
                        size={220}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                  </div>
                  <p className="text-text-secondary mt-4 text-center text-sm font-medium">
                    Scan QR di atas dengan e-wallet kamu
                  </p>
                  <p className="text-text-muted mt-1 text-center text-xs">
                    Nominal sudah terisi otomatis, tinggal konfirmasi di
                    e-wallet.
                  </p>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="border-warning/30 bg-warning/5 flex items-start gap-3 rounded-lg border p-3 text-left">
                    <AlertCircle className="text-warning h-5 w-5 shrink-0" />
                    <div className="text-xs">
                      <p className="text-text-primary font-semibold">
                        QRIS belum tersedia
                      </p>
                      <p className="text-text-muted mt-1">
                        Pihak yang menagih belum mengatur QRIS statis di
                        {data.appName}. Minta mereka untuk setup di Pengaturan →
                        QRIS agar QR otomatis tersedia di sini.
                      </p>
                      {qrisDiagnostic && (
                        <p className="text-text-muted mt-1 italic">
                          ({qrisDiagnostic.reason})
                        </p>
                      )}
                    </div>
                  </div>
                  {debug && (
                    <pre className="border-border bg-bg-elevated text-text-muted overflow-x-auto rounded-lg border p-3 font-mono text-[10px]">
                      {JSON.stringify(
                        {
                          billId: data.billId,
                          hasStaticQris: Boolean(data.staticQris),
                          staticQrisLength: data.staticQris?.length ?? 0,
                          staticQrisPreview: data.staticQris
                            ? `${data.staticQris.slice(0, 16)}…${data.staticQris.slice(-12)}`
                            : null,
                          isValidShape: data.staticQris
                            ? isValidQrisShape(data.staticQris)
                            : false,
                          diagnostic: qrisDiagnostic,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  )}
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
                className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
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

            {/* ─── Trust footer ──────────────────────────────────────────── */}
            <footer className="text-text-muted flex items-center justify-center gap-1.5 pt-2 text-[11px]">
              <ShieldCheck className="h-3 w-3" />
              Link ini aman dan hanya bisa dilihat oleh kamu.
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
      <p className="text-text-muted text-sm">Memuat tagihan…</p>
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
        className="bg-bg-elevated text-text-primary hover:bg-bg-elevated/70 rounded-lg px-4 py-2 text-sm font-medium transition"
      >
        Coba Lagi
      </button>
    </div>
  );
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
