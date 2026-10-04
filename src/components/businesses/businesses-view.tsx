"use client";

import { walletOptionLabel } from "~/lib/wallets";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { businessSummary, formatBusinessReturn } from "~/lib/business-summary";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Button } from "~/components/ui/button";
import { DatePicker } from "~/components/ui/date-picker";
import { Input } from "~/components/ui/input";
import { Modal } from "~/components/ui/modal";
import { confirm } from "~/components/ui/confirm-dialog";
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
  transactions: Entry[];
}
const selectClass =
  "h-11 w-full rounded-lg border border-border bg-bg-surface px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary";
const primaryButtonClass =
  "min-h-11 bg-[color-mix(in_oklab,var(--primary)_55%,black)] text-white hover:bg-[color-mix(in_oklab,var(--primary)_45%,black)]";
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
  const [businesses, setBusinesses] = useState<Business[]>([]);
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
  const selected = businesses.find((b) => b.id === businessId);
  const choices = flattenWalletTree(wallets);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setError("Silakan login untuk mengakses bisnis");
      return;
    }
    try {
      const data = await api.get<Business[]>("/businesses/", token);
      setBusinesses(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat bisnis");
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);

  async function refreshWallets() {
    try {
      const data = await api.bootstrap<Parameters<typeof hydrate>[0]>(token!);
      hydrate(data);
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
      if (editingBusiness)
        await api.put(`/businesses/${editingBusiness}`, token, businessForm);
      else {
        const saved = await api.post<Business>(
          "/businesses/",
          token,
          businessForm,
        );
        router.push(`/businesses/${saved.id}`);
      }
      setBusinessModal(false);
      await load();
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
      await load();
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
      await load();
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
      await load();
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
  function openEntry(entry?: Entry) {
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
        : emptyEntry(),
    );
    setFormError("");
    setEntryModal(true);
  }
  const { income, expense, returnPercent } = businessSummary(
    selected?.transactions ?? [],
  );

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
      {loading ? (
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
      ) : !businesses.length ? (
        <div className="border-border bg-bg-surface rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Belum ada bisnis</h2>
          <p className="text-text-secondary mt-2">
            Buat bisnis terlebih dahulu, lalu catat pembelian dan hasil
            penjualannya.
          </p>
        </div>
      ) : !businessId ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {businesses.map((business) => {
              const summary = businessSummary(business.transactions);
              return (
                <Link
                  key={business.id}
                  href={`/businesses/${business.id}`}
                  aria-label={`Lihat detail ${business.name}`}
                  className="border-border bg-bg-surface hover:border-primary focus-visible:outline-primary block min-w-0 rounded-xl border p-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  <h2 className="text-lg font-semibold break-words">
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
                        Selisih pemasukan & pengeluaran
                      </dt>
                      <dd className="mt-1 text-2xl font-semibold break-words tabular-nums">
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
                      {business.transactions.length} transaksi
                    </span>
                    <span className="font-medium underline underline-offset-4">
                      Lihat pencatatan
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      ) : (
        selected && (
          <>
            <section className="border-border bg-bg-surface space-y-4 rounded-xl border p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold break-words">
                    {selected.name}
                  </h2>
                  {selected.description && (
                    <p className="text-text-secondary mt-1 break-words">
                      {selected.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="min-h-11"
                    disabled={saving}
                    onClick={() => openBusiness(true)}
                  >
                    Edit bisnis
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-11"
                    disabled={saving || !!selected.transactions.length}
                    title={
                      selected.transactions.length
                        ? "Hapus semua transaksi terlebih dahulu"
                        : undefined
                    }
                    onClick={() => void removeBusiness()}
                  >
                    Hapus bisnis
                  </Button>
                </div>
              </div>
              <dl className="border-border grid gap-4 border-t pt-4 sm:grid-cols-3">
                {[
                  ["Pemasukan penjualan", income],
                  ["Pembelian / pengeluaran", expense],
                  ["Selisih pemasukan & pengeluaran", income - expense],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-text-secondary text-sm">{label}</dt>
                    <dd className="mt-1 text-xl font-semibold break-words tabular-nums">
                      {formatCurrency(Number(value))}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-text-secondary text-sm">
                Selisih dihitung dari semua transaksi yang dicatat, termasuk
                transaksi tanpa dompet.
              </p>
              <p className="text-text-secondary text-sm">
                Hasil terhadap pengeluaran:{" "}
                <span className="text-text-primary font-semibold tabular-nums">
                  {formatBusinessReturn(returnPercent)}
                </span>
                . Persentase ini bukan imbal hasil tahunan.
              </p>
            </section>
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Transaksi bisnis</h2>
                <Button
                  className={primaryButtonClass}
                  disabled={saving}
                  onClick={() => openEntry()}
                >
                  Catat transaksi
                </Button>
              </div>
              {!selected.transactions.length ? (
                <p className="border-border bg-bg-surface text-text-secondary rounded-xl border p-6">
                  Belum ada transaksi. Catat pembelian atau pemasukan pertama
                  bisnis ini.
                </p>
              ) : (
                <ul className="divide-border border-border bg-bg-surface divide-y rounded-xl border">
                  {selected.transactions.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium break-words">
                          {entry.description}
                        </p>
                        <p className="text-text-secondary mt-1 text-sm break-words">
                          {formatDate(entry.date)} ·{" "}
                          {entry.type === "income"
                            ? "Pemasukan"
                            : "Pengeluaran"}{" "}
                          · {entry.walletName ?? "Tanpa dompet"}
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold tabular-nums">
                        {entry.type === "income" ? "+" : "−"}
                        {formatCurrency(entry.amount)}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="min-h-11"
                          disabled={saving}
                          aria-label={`Edit ${entry.description}`}
                          onClick={() => openEntry(entry)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          className="min-h-11"
                          disabled={saving}
                          aria-label={`Hapus ${entry.description}`}
                          onClick={() => void removeEntry(entry)}
                        >
                          Hapus
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
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
          editingEntry ? "Edit transaksi bisnis" : "Catat transaksi bisnis"
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
            <select
              id="entry-wallet"
              className={selectClass}
              value={entryForm.walletId}
              onChange={(e) =>
                setEntryForm({ ...entryForm, walletId: e.target.value })
              }
            >
              <option value="">Tanpa dompet</option>
              {choices.map((w) => (
                <option key={w.id} value={w.id}>
                  {walletOptionLabel(w, choices)}
                </option>
              ))}
            </select>
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
