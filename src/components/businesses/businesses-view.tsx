"use client";

import { WalletPicker } from "~/components/ui/wallet-select";
import { BusinessDashboardPanel } from "~/components/businesses/business-dashboard";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  Pencil,
  Plus,
  Search,
  Store,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { formatBusinessReturn } from "~/lib/business-summary";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Button } from "~/components/ui/button";
import { DatePicker } from "~/components/ui/date-picker";
import { Input } from "~/components/ui/input";
import { Modal } from "~/components/ui/modal";
import { confirm } from "~/components/ui/confirm-dialog";
import { Pagination } from "~/components/ui/pagination";
import { useServerPagination } from "~/lib/use-server-pagination";
import { ServerListStatus } from "~/components/ui/server-paginated-list";
import { invalidateServerLists } from "~/lib/page-records";
import { api } from "~/lib/api";
import { formatCurrency, formatDate } from "~/lib/utils";
import { localDateValue, parseDateValue } from "~/lib/date";
import { useAuthStore } from "~/store/useAuthStore";
import { useFinanceStore } from "~/store/useFinanceStore";
import { flattenWalletTree } from "~/lib/wallets";

interface Entry {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  date: string;
  walletId: string | null;
  walletName: string | null;
}
interface Business {
  id: string;
  name: string;
  description: string;
  summary: BusinessTotals;
}
interface BusinessTotals {
  income: number;
  expense: number;
  difference: number;
  returnPercent: number | null;
  transactionCount: number;
}
const selectClass =
  "h-11 w-full rounded-lg border border-border bg-bg-surface px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary";
const primaryButtonClass = "min-h-11";
function emptyEntry() {
  return {
    type: "expense" as Entry["type"],
    amount: "",
    description: "",
    date: localDateValue(),
    walletId: "",
  };
}

export function BusinessesView({ businessId }: { businessId?: string }) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const wallets = useFinanceStore((s) => s.wallets);
  const hydrate = useFinanceStore((s) => s.hydrateFromBackend);
  const detailScope = `${token ?? ""}|${businessId ?? ""}`;
  const currentDetailScope = useRef(detailScope);
  currentDetailScope.current = detailScope;
  const [detail, setDetail] = useState<{
    scope: string;
    business: Business;
  } | null>(null);
  const selected = detail?.scope === detailScope ? detail.business : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [businessModal, setBusinessModal] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<string | null>(null);
  const [businessForm, setBusinessForm] = useState({
    name: "",
    description: "",
  });
  const [entryModal, setEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState(emptyEntry);
  const [formError, setFormError] = useState("");
  const [entryFilter, setEntryFilter] = useState<"all" | Entry["type"]>("all");
  const [entrySearch, setEntrySearch] = useState("");
  const choices = flattenWalletTree(wallets);
  const businessPager = useServerPagination<Business>(
    businessId ? null : "/businesses/",
  );
  const entryPager = useServerPagination<Entry, BusinessTotals>(
    businessId ? `/businesses/${businessId}/transactions` : null,
    {
      type: entryFilter === "all" ? undefined : entryFilter,
      search: entrySearch.trim() || undefined,
    },
  );
  const businesses = businessPager.items;

  const load = useCallback(async () => {
    if (!businessId || !token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const business = await api.get<Business>(
        `/businesses/${businessId}`,
        token,
      );
      if (currentDetailScope.current !== detailScope) return;
      setDetail({ scope: detailScope, business });
      setError("");
    } catch (err) {
      if (currentDetailScope.current !== detailScope) return;
      setError(err instanceof Error ? err.message : "Gagal memuat bisnis");
    } finally {
      if (currentDetailScope.current === detailScope) setLoading(false);
    }
  }, [token, businessId, detailScope]);
  useEffect(() => {
    void load();
  }, [load]);

  async function refreshWallets() {
    invalidateServerLists(["/businesses", "/wallets", "/analytics"]);
    try {
      const data = await api.get<{
        wallets: Parameters<typeof hydrate>[0]["wallets"];
      }>("/lookups", token!);
      if (token === useAuthStore.getState().token) hydrate(data);
    } catch {
      setError(
        "Transaksi tersimpan, tetapi saldo dompet belum diperbarui di layar. Muat ulang halaman.",
      );
    }
  }
  async function saveBusiness(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !token) return;
    setSaving(true);
    setFormError("");
    try {
      if (editingBusiness) {
        await api.put(`/businesses/${editingBusiness}`, token, businessForm);
        if (currentDetailScope.current === detailScope && selected) {
          setDetail({
            scope: detailScope,
            business: {
              ...selected,
              ...businessForm,
              name: businessForm.name.trim(),
            },
          });
        }
      } else {
        const saved = await api.post<Business>(
          "/businesses/",
          token,
          businessForm,
        );
        router.push(`/businesses/${saved.id}`);
      }
      setBusinessModal(false);
      invalidateServerLists(["/businesses"]);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Gagal menyimpan bisnis",
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveEntry(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !token || !selected) return;
    const date = parseDateValue(entryForm.date);
    if (
      !date ||
      Number(entryForm.amount) <= 0 ||
      !entryForm.description.trim()
    ) {
      setFormError("Isi nominal positif, keterangan, dan tanggal yang valid");
      return;
    }
    setSaving(true);
    setFormError("");
    const path = `/businesses/${selected.id}/transactions`;
    const body = {
      ...entryForm,
      amount: Number(entryForm.amount),
      date: date.toISOString(),
      walletId: entryForm.walletId || null,
    };
    try {
      if (editingEntry) await api.put(`${path}/${editingEntry}`, token, body);
      else await api.post(path, token, body);
      setEntryModal(false);
      await refreshWallets();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Gagal menyimpan transaksi",
      );
    } finally {
      setSaving(false);
    }
  }
  async function removeEntry(entry: Entry) {
    if (!selected || !token || saving) return;
    if (
      !(await confirm({
        title: "Hapus transaksi bisnis?",
        message:
          "Perubahan saldo transaksi ini akan dikembalikan ke dompet terkait.",
        variant: "danger",
      }))
    )
      return;
    setSaving(true);
    try {
      await api.delete(
        `/businesses/${selected.id}/transactions/${entry.id}`,
        token,
      );
      await refreshWallets();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menghapus transaksi",
      );
    } finally {
      setSaving(false);
    }
  }
  async function removeBusiness() {
    if (!selected || !token || saving) return;
    if (
      !(await confirm({
        title: `Hapus ${selected.name}?`,
        message: "Bisnis kosong ini akan dihapus.",
        variant: "danger",
      }))
    )
      return;
    setSaving(true);
    try {
      await api.delete(`/businesses/${selected.id}`, token);
      router.push("/businesses");
      invalidateServerLists(["/businesses"]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus bisnis");
    } finally {
      setSaving(false);
    }
  }
  function openBusiness(edit = false) {
    setEditingBusiness(edit && selected ? selected.id : null);
    setBusinessForm(
      edit && selected
        ? { name: selected.name, description: selected.description }
        : { name: "", description: "" },
    );
    setFormError("");
    setBusinessModal(true);
  }
  function openEntry(entry?: Entry, type: Entry["type"] = "expense") {
    setEditingEntry(entry?.id ?? null);
    setEntryForm(
      entry
        ? {
            type: entry.type,
            amount: String(entry.amount),
            description: entry.description,
            date: localDateValue(new Date(entry.date)),
            walletId: entry.walletId ?? "",
          }
        : { ...emptyEntry(), type },
    );
    setFormError("");
    setEntryModal(true);
  }
  const {
    income = 0,
    expense = 0,
    returnPercent = null,
    transactionCount = 0,
  } = entryPager.summary ?? selected?.summary ?? {};
  const difference = income - expense;
  const coverage = expense > 0 ? Math.min(100, (income / expense) * 100) : 0;
  const hasEntryFilters = entryFilter !== "all" || !!entrySearch.trim();
  const businessMessage =
    transactionCount === 0
      ? "Mulai dari satu catatan. Lihat usahamu berjalan dari sini."
      : income === 0
        ? "Pengeluaran sudah tercatat. Saat ada penjualan, catat hasilnya di sini."
        : expense === 0
          ? "Pemasukan sudah tercatat. Lengkapi pengeluaran agar hasil usaha lebih jelas."
          : difference > 0
            ? "Pemasukanmu sudah menutup pengeluaran yang tercatat."
            : difference === 0
              ? "Pemasukan dan pengeluaran yang tercatat sudah seimbang."
              : "Catatan yang rapi membantu melihat pengeluaran yang belum tertutup.";

  return (
    <PageWrapper
      title={selected?.name ?? "Bisnis"}
      actions={
        !businessId ? (
          <Button
            className={primaryButtonClass}
            onClick={() => openBusiness()}
            disabled={loading || saving}
          >
            Buat bisnis
          </Button>
        ) : undefined
      }
    >
      {!businessId && <BusinessDashboardPanel />}
      <ServerListStatus {...(businessId ? entryPager : businessPager)} />
      {businessId && (
        <Link
          href="/businesses"
          className="text-text-secondary focus-visible:outline-primary inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm underline underline-offset-4 focus-visible:outline-2"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          Kembali ke semua bisnis
        </Link>
      )}
      {error && (
        <div
          role="alert"
          className="border-danger text-text-primary rounded-xl border p-4"
        >
          <p>{error}</p>
          <Button
            variant="outline"
            className="mt-3 min-h-11"
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            Coba lagi
          </Button>
        </div>
      )}
      {(loading && !selected) || (!businessId && businessPager.loading) ? (
        <p role="status" className="text-text-secondary">
          Memuat bisnis...
        </p>
      ) : businessId && !selected ? (
        <div className="border-border bg-bg-surface rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Bisnis tidak ditemukan</h2>
          <p className="text-text-secondary mt-2">
            Kembali ke daftar untuk memilih bisnis yang tersedia.
          </p>
        </div>
      ) : !businessId && businessPager.initialized && !businesses.length ? (
        <div className="border-border bg-bg-surface rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Belum ada bisnis</h2>
          <p className="text-text-secondary mt-2">
            Buat bisnis terlebih dahulu, lalu catat pembelian dan hasil
            penjualannya.
          </p>
        </div>
      ) : !businessId ? (
        <>
          <div>
            <h2 className="text-xl font-semibold">Buku kas bisnis</h2>
            <p className="text-text-secondary mt-1 text-sm">
              Buka bisnis untuk mencatat transaksi. Angka pada kartu mencakup
              seluruh waktu, terpisah dari filter dashboard.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {businessPager.items.map((business) => {
              const summary = business.summary;
              return (
                <Link
                  key={business.id}
                  href={`/businesses/${business.id}`}
                  aria-label={`Lihat detail ${business.name}`}
                  className="border-border bg-bg-surface hover:border-primary focus-visible:outline-primary block min-w-0 rounded-xl border p-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  <h2 className="text-lg font-semibold break-words">
                    <Store
                      aria-hidden
                      className="text-text-secondary mr-2 inline-block h-5 w-5 align-text-bottom"
                    />
                    {business.name}
                  </h2>
                  {business.description && (
                    <p className="text-text-secondary mt-1 text-sm break-words">
                      {business.description}
                    </p>
                  )}
                  <dl className="mt-5 space-y-3">
                    <div>
                      <dt className="text-text-secondary text-sm">
                        Selisih usaha
                      </dt>
                      <dd
                        className={`mt-1 text-3xl font-semibold tracking-tight break-words tabular-nums ${summary.difference > 0 ? "text-success" : summary.difference < 0 ? "text-danger" : "text-text-primary"}`}
                      >
                        {formatCurrency(summary.difference)}
                      </dd>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt className="text-text-secondary text-sm">
                        Hasil terhadap pengeluaran
                      </dt>
                      <dd className="font-semibold tabular-nums">
                        {formatBusinessReturn(summary.returnPercent)}
                      </dd>
                    </div>
                    <div className="border-border flex flex-wrap justify-between gap-2 border-t pt-3">
                      <dt className="text-text-secondary text-sm">Pemasukan</dt>
                      <dd className="tabular-nums">
                        {formatCurrency(summary.income)}
                      </dd>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt className="text-text-secondary text-sm">
                        Pengeluaran
                      </dt>
                      <dd className="tabular-nums">
                        {formatCurrency(summary.expense)}
                      </dd>
                    </div>
                  </dl>
                  <div className="border-border mt-5 flex flex-wrap justify-between gap-2 border-t pt-3 text-sm">
                    <span className="text-text-secondary">
                      {business.summary.transactionCount} transaksi
                    </span>
                    <span className="font-medium underline underline-offset-4">
                      Buka buku kas
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
          <Pagination {...businessPager} label="bisnis" />
        </>
      ) : (
        selected && (
          <>
            <section
              aria-label="Ringkasan usaha"
              className="border-border bg-bg-surface overflow-hidden rounded-2xl border"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5 sm:px-7 sm:pt-7">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="bg-primary/10 border-primary/20 text-text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border">
                    <Store aria-hidden className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-text-secondary text-xs font-medium">
                      Buku usaha
                    </p>
                    <h2 className="text-text-primary mt-0.5 text-xl font-semibold tracking-tight break-words sm:text-2xl">
                      {selected.name}
                    </h2>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    className="h-11 w-11 shrink-0 p-0"
                    aria-label="Edit bisnis"
                    title="Edit bisnis"
                    disabled={saving}
                    onClick={() => openBusiness(true)}
                  >
                    <Pencil aria-hidden className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="hover:text-danger h-11 w-11 shrink-0 p-0"
                    aria-label="Hapus bisnis"
                    disabled={saving || !!transactionCount}
                    title={
                      transactionCount
                        ? "Hapus semua transaksi terlebih dahulu"
                        : "Hapus bisnis"
                    }
                    onClick={() => void removeBusiness()}
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {selected.description && (
                <p className="text-text-secondary mt-3 px-5 text-sm leading-relaxed break-words sm:px-7">
                  {selected.description}
                </p>
              )}
              <div className="mt-6 grid lg:grid-cols-[1.3fr_1fr]">
                <div className="min-w-0 px-5 pb-6 sm:px-7 sm:pb-7">
                  <p className="text-text-secondary text-sm">
                    Selisih usaha{" "}
                    <span className="text-text-secondary/80">
                      · semua catatan
                    </span>
                  </p>
                  <p
                    className={`mt-2 text-3xl font-semibold tracking-tight break-words tabular-nums sm:text-4xl xl:text-5xl ${difference > 0 ? "text-success" : difference < 0 ? "text-danger" : "text-text-primary"}`}
                  >
                    {difference > 0 ? "+" : ""}
                    {formatCurrency(difference)}
                  </p>
                  <p className="text-text-secondary mt-3 max-w-md text-sm leading-relaxed">
                    {businessMessage}
                  </p>
                  <dl className="border-border mt-6 grid grid-cols-2 gap-4 border-t pt-5">
                    <div>
                      <dt className="text-text-secondary flex items-center gap-1.5 text-xs">
                        <ArrowDownLeft
                          aria-hidden
                          className="text-success h-4 w-4"
                        />{" "}
                        Pemasukan
                      </dt>
                      <dd className="text-text-primary mt-1.5 text-base font-semibold break-words tabular-nums sm:text-lg">
                        {formatCurrency(income)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary flex items-center gap-1.5 text-xs">
                        <ArrowUpRight
                          aria-hidden
                          className="text-danger h-4 w-4"
                        />{" "}
                        Pengeluaran
                      </dt>
                      <dd className="text-text-primary mt-1.5 text-base font-semibold break-words tabular-nums sm:text-lg">
                        {formatCurrency(expense)}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="border-border bg-bg-elevated/45 flex min-w-0 flex-col justify-between gap-6 border-t px-5 py-6 sm:px-7 lg:border-t-0 lg:border-l">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-text-primary text-sm font-semibold">
                        Pengeluaran tertutup
                      </h3>
                      {expense > 0 && (
                        <span className="text-text-primary text-sm font-semibold tabular-nums">
                          {new Intl.NumberFormat("id-ID", {
                            maximumFractionDigits: 1,
                          }).format(coverage)}
                          %
                        </span>
                      )}
                    </div>
                    <div
                      role="progressbar"
                      aria-label="Pengeluaran yang tertutup pemasukan"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={coverage}
                      aria-valuetext={
                        expense > 0
                          ? `${coverage.toFixed(1)}% pengeluaran tertutup pemasukan`
                          : "Belum ada pengeluaran untuk dibandingkan"
                      }
                      className="bg-bg-elevated mt-3 h-2.5 overflow-hidden rounded-sm"
                    >
                      <div
                        className={
                          coverage >= 100
                            ? "bg-success h-full"
                            : "h-full bg-[light-dark(#b45309,var(--primary))]"
                        }
                        style={{ width: `${coverage}%` }}
                      />
                    </div>
                    <p className="text-text-secondary mt-3 text-sm leading-relaxed">
                      {expense === 0 ? (
                        "Indikator akan terisi setelah pemasukan dan pengeluaran mulai dicatat."
                      ) : difference >= 0 ? (
                        <span className="flex items-start gap-2">
                          <Check
                            aria-hidden
                            className="text-success mt-0.5 h-4 w-4 shrink-0"
                          />
                          {difference > 0
                            ? "Seluruh pengeluaran tertutup. Ada selisih lebih dari catatan usahamu."
                            : "Seluruh pengeluaran tertutup oleh pemasukan."}
                        </span>
                      ) : (
                        <>
                          Masih{" "}
                          <span className="text-text-primary font-medium tabular-nums">
                            {formatCurrency(-difference)}
                          </span>{" "}
                          untuk menutup pengeluaran yang tercatat.
                        </>
                      )}
                    </p>
                    {expense > 0 && (
                      <div className="border-border mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
                        <span className="text-text-secondary">
                          Selisih terhadap pengeluaran
                        </span>
                        <span className="text-text-primary font-semibold tabular-nums">
                          {formatBusinessReturn(returnPercent)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Button
                      className={`${primaryButtonClass} w-full`}
                      disabled={saving}
                      leftIcon={<Plus aria-hidden className="h-4 w-4" />}
                      onClick={() => openEntry(undefined, "income")}
                    >
                      Catat penjualan
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-11 w-full"
                      disabled={saving}
                      onClick={() => openEntry(undefined, "expense")}
                    >
                      Catat pengeluaran
                    </Button>
                  </div>
                </div>
              </div>
              <div className="border-border text-text-secondary flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3 text-xs sm:px-7">
                <span className="flex items-center gap-2">
                  <BookOpen aria-hidden className="h-3.5 w-3.5" />
                  {transactionCount.toLocaleString("id-ID")} transaksi tercatat
                </span>
                <span>Semua periode, termasuk catatan tanpa dompet.</span>
              </div>
            </section>
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-text-primary text-lg font-semibold">
                    Buku kas
                  </h2>
                  <p className="text-text-secondary mt-1 text-sm">
                    Setiap pemasukan dan pengeluaran, tersimpan rapi.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="min-h-11"
                  leftIcon={<Plus aria-hidden className="h-4 w-4" />}
                  disabled={saving}
                  onClick={() => openEntry()}
                >
                  Catat transaksi
                </Button>
              </div>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div
                  role="group"
                  aria-label="Filter jenis transaksi bisnis"
                  className="border-border bg-bg-surface flex w-fit max-w-full gap-1 rounded-lg border p-1"
                >
                  {(
                    [
                      ["all", "Semua"],
                      ["income", "Pemasukan"],
                      ["expense", "Pengeluaran"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={entryFilter === value}
                      onClick={() => setEntryFilter(value)}
                      className={`focus-visible:ring-primary min-h-11 rounded-md px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none sm:text-sm ${entryFilter === value ? "bg-text-primary text-bg-surface" : "text-text-secondary hover:bg-bg-elevated/60"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="relative min-w-0 sm:w-64">
                  <Search
                    aria-hidden
                    className="text-text-secondary pointer-events-none absolute top-3.5 left-3 h-4 w-4"
                  />
                  <input
                    aria-label="Cari transaksi bisnis"
                    placeholder="Cari keterangan transaksi..."
                    value={entrySearch}
                    onChange={(event) => setEntrySearch(event.target.value)}
                    className="border-border bg-bg-surface text-text-primary placeholder:text-text-secondary focus-visible:ring-primary h-11 w-full rounded-lg border pr-3 pl-9 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  />
                </div>
              </div>
              {entryPager.initialized && !entryPager.total ? (
                <div className="border-border bg-bg-surface flex flex-col items-center rounded-xl border px-5 py-10 text-center sm:py-14">
                  <div className="bg-bg-elevated text-text-secondary mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
                    <BookOpen aria-hidden className="h-6 w-6" />
                  </div>
                  <h3 className="text-text-primary text-base font-semibold">
                    {hasEntryFilters
                      ? "Belum ada catatan yang cocok"
                      : "Catatan pertama usahamu dimulai di sini"}
                  </h3>
                  <p className="text-text-secondary mt-2 max-w-sm text-sm leading-relaxed">
                    {hasEntryFilters
                      ? "Coba kata kunci lain atau tampilkan semua jenis transaksi."
                      : "Baru belanja bahan atau sudah dapat pesanan? Catat nominalnya agar hasil usahamu mulai terlihat."}
                  </p>
                  {hasEntryFilters ? (
                    <Button
                      variant="outline"
                      className="mt-5 min-h-11"
                      onClick={() => {
                        setEntryFilter("all");
                        setEntrySearch("");
                      }}
                    >
                      Tampilkan semua catatan
                    </Button>
                  ) : (
                    <Button
                      className={`${primaryButtonClass} mt-5`}
                      onClick={() => openEntry(undefined, "income")}
                      disabled={saving}
                    >
                      Catat pemasukan pertama
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <ul
                    aria-label="Riwayat transaksi bisnis"
                    className="divide-border border-border bg-bg-surface divide-y overflow-hidden rounded-xl border"
                  >
                    {entryPager.items.map((entry) => (
                      <li
                        key={entry.id}
                        className="hover:bg-bg-elevated/35 grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 p-4 transition-colors sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(7rem,auto)_auto] sm:gap-4 sm:px-5"
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${entry.type === "income" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
                        >
                          {entry.type === "income" ? (
                            <ArrowDownLeft aria-hidden className="h-5 w-5" />
                          ) : (
                            <ArrowUpRight aria-hidden className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium break-words">
                            {entry.description}
                          </p>
                          <p className="text-text-secondary mt-1 text-xs break-words">
                            {formatDate(entry.date)} ·{" "}
                            {entry.type === "income"
                              ? "Pemasukan"
                              : "Pengeluaran"}{" "}
                            · {entry.walletName ?? "Tanpa dompet"}
                          </p>
                        </div>
                        <p
                          className={`col-start-2 row-start-2 font-semibold break-words tabular-nums sm:col-start-3 sm:row-start-1 sm:text-right ${entry.type === "income" ? "text-[color:light-dark(#15803d,#4ade80)]" : "text-text-primary"}`}
                        >
                          {entry.type === "income" ? "+" : "−"}
                          {formatCurrency(entry.amount)}
                        </p>
                        <div className="col-start-3 row-span-2 row-start-1 flex flex-col gap-1 sm:col-start-4 sm:row-span-1 sm:flex-row">
                          <Button
                            variant="ghost"
                            className="h-11 w-11 shrink-0 p-0"
                            title="Edit transaksi"
                            disabled={saving}
                            aria-label={`Edit ${entry.description}`}
                            onClick={() => openEntry(entry)}
                          >
                            <Pencil aria-hidden className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            className="hover:text-danger h-11 w-11 shrink-0 p-0"
                            title="Hapus transaksi"
                            disabled={saving}
                            aria-label={`Hapus ${entry.description}`}
                            onClick={() => void removeEntry(entry)}
                          >
                            <Trash2 aria-hidden className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Pagination {...entryPager} label="transaksi bisnis" />
                </>
              )}
            </section>
          </>
        )
      )}
      <Modal
        open={businessModal}
        onClose={() => {
          if (!saving) setBusinessModal(false);
        }}
        title={editingBusiness ? "Edit bisnis" : "Buat bisnis"}
        description="Pisahkan pencatatan untuk setiap usaha."
      >
        <form onSubmit={saveBusiness} className="space-y-4">
          <Input
            label="Nama bisnis"
            value={businessForm.name}
            required
            maxLength={120}
            onChange={(e) =>
              setBusinessForm({ ...businessForm, name: e.target.value })
            }
          />
          <Input
            label="Keterangan bisnis"
            value={businessForm.description}
            maxLength={1000}
            onChange={(e) =>
              setBusinessForm({ ...businessForm, description: e.target.value })
            }
          />
          {formError && (
            <p role="alert" className="text-text-primary text-sm">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={saving}
              onClick={() => setBusinessModal(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              className={primaryButtonClass}
              loading={saving}
            >
              Simpan bisnis
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={entryModal}
        onClose={() => {
          if (!saving) setEntryModal(false);
        }}
        title={
          editingEntry
            ? "Edit transaksi bisnis"
            : entryForm.type === "income"
              ? "Catat pemasukan"
              : "Catat pengeluaran"
        }
        description={selected?.name}
      >
        <form onSubmit={saveEntry} className="space-y-4">
          <div>
            <label
              htmlFor="entry-type"
              className="text-text-secondary mb-1.5 block text-sm font-medium"
            >
              Jenis transaksi
            </label>
            <select
              id="entry-type"
              className={selectClass}
              value={entryForm.type}
              onChange={(e) =>
                setEntryForm({
                  ...entryForm,
                  type: e.target.value as Entry["type"],
                })
              }
            >
              <option value="expense">Pembelian / pengeluaran</option>
              <option value="income">Pemasukan penjualan</option>
            </select>
          </div>
          <Input
            label="Nominal (Rp)"
            currency
            type="number"
            min="0.01"
            max="1000000000000"
            step="0.01"
            required
            value={entryForm.amount}
            onChange={(e) =>
              setEntryForm({ ...entryForm, amount: e.target.value })
            }
          />
          <Input
            label="Keterangan transaksi"
            required
            maxLength={1000}
            value={entryForm.description}
            onChange={(e) =>
              setEntryForm({ ...entryForm, description: e.target.value })
            }
          />
          <DatePicker
            label="Tanggal"
            required
            value={entryForm.date}
            onValueChange={(value) =>
              setEntryForm({ ...entryForm, date: value })
            }
          />
          <div>
            <label
              htmlFor="entry-wallet"
              className="text-text-secondary mb-1.5 block text-sm font-medium"
            >
              {entryForm.type === "expense"
                ? "Dompet pembayaran"
                : "Dompet penerimaan"}
            </label>
            <WalletPicker
              id="entry-wallet"
              value={entryForm.walletId}
              onChange={(value) =>
                setEntryForm({ ...entryForm, walletId: value })
              }
              wallets={choices}
              emptyLabel="Tanpa dompet"
            />
            <p className="text-text-secondary mt-2 text-sm">
              {entryForm.walletId
                ? entryForm.type === "expense"
                  ? "Saldo dompet berkurang sesuai nominal pembelian."
                  : "Saldo dompet bertambah sesuai nominal pemasukan."
                : "Dicatat untuk bisnis tanpa mengubah saldo dompet."}
            </p>
          </div>
          {formError && (
            <p role="alert" className="text-text-primary text-sm">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={saving}
              onClick={() => setEntryModal(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              className={primaryButtonClass}
              loading={saving}
            >
              Simpan transaksi
            </Button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  );
}
