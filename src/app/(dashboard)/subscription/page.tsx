"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { api } from "~/lib/api";
import type { BillingOverview, SubscriptionInvoice } from "~/lib/subscriptions";
import { useAuthStore } from "~/store/useAuthStore";
import { Pagination } from "~/components/ui/pagination";
import { useServerPagination } from "~/lib/use-server-pagination";
import { ServerListStatus } from "~/components/ui/server-paginated-list";
import { invalidateServerLists } from "~/lib/page-records";

const money = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
const date = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
const labels: Record<string, string> = {
  creating: "Menyiapkan QRIS",
  pending: "Menunggu pembayaran",
  paid: "Lunas",
  expired: "Batas pembayaran berakhir",
  failed: "Invoice gagal atau dibatalkan",
};

export default function SubscriptionPage() {
  const token = useAuthStore((state) => state.token);
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [checkAfter, setCheckAfter] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<SubscriptionInvoice | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const invoicePager = useServerPagination<SubscriptionInvoice>(
    "/subscriptions/invoices",
  );
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      setOverview(await api.get<BillingOverview>("/subscriptions/", token));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Gagal memuat langganan",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const activeInvoiceId = selectedId ?? overview?.latestInvoiceId;
  useEffect(() => {
    if (!token || !activeInvoiceId) {
      setInvoice(null);
      return;
    }
    let cancelled = false;
    setInvoice(null);
    setInvoiceLoading(true);
    void api
      .get<SubscriptionInvoice>(
        `/subscriptions/invoices/${activeInvoiceId}`,
        token,
      )
      .then((row) => {
        if (!cancelled) setInvoice(row);
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(
            cause instanceof Error ? cause.message : "Gagal memuat invoice",
          );
      })
      .finally(() => {
        if (!cancelled) setInvoiceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, activeInvoiceId]);
  const hasOpenInvoice = Boolean(
    overview?.openInvoice && now < Date.parse(overview.openInvoice.expiresAt),
  );
  const expired = invoice ? now >= Date.parse(invoice.expiresAt) : false;
  const pending = invoice?.status === "pending" && !expired;
  const creating = invoice?.status === "creating" && !expired;
  const status =
    invoice && ["pending", "creating"].includes(invoice.status) && expired
      ? "expired"
      : invoice?.status;
  const seconds = invoice
    ? Math.max(0, Math.ceil((Date.parse(invoice.expiresAt) - now) / 1000))
    : 0;
  const canCheck =
    invoice &&
    ["pending", "expired"].includes(invoice.status) &&
    now < Date.parse(invoice.expiresAt) + 86_400_000 &&
    overview?.available;

  const act = useCallback(
    async (check: boolean) => {
      if (!token || busy) return;
      setBusy(true);
      setError("");
      if (check) setCheckAfter(Date.now() + 15_000);
      try {
        const saved = await api.post<SubscriptionInvoice>(
          check
            ? `/subscriptions/invoices/${invoice!.id}/check`
            : "/subscriptions/invoices",
          token,
          {},
        );
        setInvoice(saved);
        invalidateServerLists(["/subscriptions/invoices"]);
        setSelectedId(saved.id);
        await load();
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Gagal memproses pembayaran",
        );
      } finally {
        setBusy(false);
      }
    },
    [token, busy, invoice, load],
  );

  // Returning from the hosted checkout re-reads status from the backend,
  // throttled by the 15 second window the API already enforces.
  useEffect(() => {
    if (!pending) return;
    const onVisibility = () => {
      if (document.visibilityState === "visible" && Date.now() >= checkAfter)
        void act(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pending, checkAfter, act]);

  return (
    <PageWrapper title="Langganan" subtitle="Status paket dan pembayaran QRIS">
      <div className="mx-auto max-w-4xl space-y-6">
        <ServerListStatus {...invoicePager} />
        {invoiceLoading && (
          <p role="status" className="text-text-secondary text-sm">
            Memuat invoice...
          </p>
        )}
        {error && (
          <div
            role="alert"
            className="border-border bg-bg-surface rounded-xl border p-4"
          >
            <p className="text-text-primary text-sm">{error}</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => void load()}
              disabled={busy || loading}
            >
              Muat ulang
            </Button>
          </div>
        )}
        {loading && (
          <p role="status" className="text-text-secondary text-sm">
            Memuat status langganan...
          </p>
        )}
        {overview && (
          <>
            <section className="border-border bg-bg-surface rounded-xl border p-5 sm:p-8">
              <h2 className="text-text-primary text-xl font-semibold">
                {overview.subscription?.active &&
                Date.parse(overview.subscription.expiresAt) > now
                  ? "Langganan aktif"
                  : "Belum ada langganan aktif"}
              </h2>
              {overview.subscription && (
                <p className="text-text-secondary mt-2 text-sm">
                  Masa berlaku: {date(overview.subscription.expiresAt)} WIB
                </p>
              )}
              {!overview.available || !overview.plan ? (
                <p className="text-text-secondary mt-3 text-sm leading-relaxed">
                  Pembayaran langganan belum dibuka. Harga dan ketentuan paket
                  akan diumumkan saat layanan siap.
                </p>
              ) : (
                <>
                  <h3 className="text-text-primary mt-5 text-base font-semibold">
                    {overview.plan.name}
                  </h3>
                  <p className="text-text-primary mt-2 text-3xl font-bold tabular-nums">
                    {money(overview.plan.price)}{" "}
                    <span className="text-text-secondary text-sm font-normal">
                      / {overview.plan.durationDays} hari
                    </span>
                  </p>
                  <p className="text-text-secondary mt-3 text-sm leading-relaxed">
                    Setiap pembayaran menambah masa langganan. Perpanjangan
                    dibayar melalui QRIS setiap periode. Total invoice dapat
                    ditambah kode unik Rp0 sampai Rp99 oleh gateway; bayar tepat
                    sesuai total yang tertera.
                  </p>
                  <Button
                    className="mt-5 min-h-11"
                    disabled={busy || loading || hasOpenInvoice}
                    loading={busy && !canCheck}
                    onClick={() => void act(false)}
                  >
                    Buat invoice QRIS
                  </Button>
                </>
              )}
            </section>
            {invoice && (
              <section
                className="border-border bg-bg-surface rounded-xl border p-5 sm:p-8"
                aria-labelledby="invoice-title"
              >
                <div className="grid gap-8 md:grid-cols-2">
                  <div>
                    <h2
                      id="invoice-title"
                      className="text-text-primary text-lg font-semibold"
                    >
                      Invoice {invoice.planName}
                    </h2>
                    <p
                      role="status"
                      className="text-text-secondary mt-2 text-sm"
                    >
                      {labels[status ?? ""] ?? "Status belum tersedia"}
                    </p>
                    <dl className="mt-5 space-y-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-text-secondary">Harga paket</dt>
                        <dd className="text-text-primary tabular-nums">
                          {money(invoice.baseAmount)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-text-secondary">Nominal unik</dt>
                        <dd className="text-text-primary tabular-nums">
                          {money(invoice.uniqueAmount)}
                        </dd>
                      </div>
                      <div className="border-border flex justify-between gap-3 border-t pt-3 font-semibold">
                        <dt>Total dibayar</dt>
                        <dd className="tabular-nums">
                          {money(invoice.amount)}
                        </dd>
                      </div>
                    </dl>
                    <p className="text-text-secondary mt-4 text-sm">
                      Batas pembayaran: {date(invoice.expiresAt)} WIB
                    </p>
                    <p className="text-text-secondary mt-2 text-xs break-all">
                      ID invoice: {invoice.id}
                    </p>
                    {pending && (
                      <p className="text-text-primary mt-4 text-sm tabular-nums">
                        Sisa waktu {Math.floor(seconds / 60)}:
                        {String(seconds % 60).padStart(2, "0")}
                      </p>
                    )}
                    {status === "expired" && (
                      <p className="text-text-secondary mt-4 text-sm">
                        Jangan bayar QRIS lama. Pembayaran setelah batas waktu
                        perlu ditinjau pengelola. Jika sudah membayar sebelum
                        batas waktu, periksa status kembali.
                      </p>
                    )}
                    {canCheck && (
                      <Button
                        className="mt-5 min-h-11"
                        onClick={() => void act(true)}
                        disabled={busy || loading || now < checkAfter}
                        loading={busy}
                      >
                        Periksa pembayaran
                      </Button>
                    )}
                    {creating && (
                      <Button
                        variant="outline"
                        className="mt-5 min-h-11"
                        onClick={() => void load()}
                        disabled={loading || busy}
                      >
                        Muat status QRIS
                      </Button>
                    )}
                  </div>
                  {pending && (invoice.qrisCode || invoice.checkoutUrl) && (
                    <div className="flex flex-col items-center justify-center gap-4">
                      {invoice.qrisCode && (
                        <>
                          <div className="w-full max-w-[272px] rounded-lg bg-white p-4">
                            <QRCodeSVG
                              value={invoice.qrisCode}
                              size={240}
                              marginSize={4}
                              className="h-auto w-full"
                              title={`QRIS pembayaran ${money(invoice.amount)}`}
                            />
                          </div>
                          <p className="text-text-secondary max-w-xs text-center text-sm">
                            Scan dengan aplikasi bank atau e-wallet. Pastikan
                            nama merchant dan total {money(invoice.amount)}{" "}
                            sesuai sebelum membayar.
                          </p>
                        </>
                      )}
                      {invoice.checkoutUrl && (
                        <>
                          <a
                            href={invoice.checkoutUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              buttonVariants({
                                variant: "outline",
                                size: "lg",
                              }),
                              "min-h-11",
                            )}
                          >
                            Buka halaman pembayaran
                          </a>
                          <p className="text-text-secondary max-w-xs text-center text-xs">
                            Kembali ke tab ini setelah membayar, lalu periksa
                            status pembayaran.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}
            <section className="border-border bg-bg-surface rounded-xl border p-5 sm:p-8">
              <h2 className="text-text-primary text-lg font-semibold">
                Riwayat invoice
              </h2>
              {invoicePager.initialized && !invoicePager.total ? (
                <p className="text-text-secondary mt-3 text-sm">
                  Belum ada invoice. Invoice akan muncul setelah kamu membuat
                  pembayaran langganan.
                </p>
              ) : (
                <>
                  <ul className="divide-border mt-3 divide-y">
                    {invoicePager.items.map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm"
                      >
                        <div>
                          <p className="text-text-primary">
                            {row.planName} · {money(row.amount)}
                          </p>
                          <p className="text-text-secondary mt-1">
                            {date(row.createdAt)} WIB
                          </p>
                          <p className="text-text-secondary mt-1 text-xs break-all">
                            {row.id}
                          </p>
                        </div>
                        <p className="text-text-secondary">
                          {labels[
                            ["pending", "creating"].includes(row.status) &&
                            now >= Date.parse(row.expiresAt)
                              ? "expired"
                              : row.status
                          ] ?? row.status}
                        </p>
                        <Button
                          variant="outline"
                          className="min-h-11"
                          disabled={busy || loading}
                          onClick={() => setSelectedId(row.id)}
                        >
                          Lihat invoice
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <Pagination {...invoicePager} label="invoice" />
                </>
              )}
            </section>
          </>
        )}
      </div>
    </PageWrapper>
  );
}
