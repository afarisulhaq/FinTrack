"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { DatePicker } from "~/components/ui/date-picker";
import { Modal } from "~/components/ui/modal";
import { WalletSelect } from "~/components/ui/wallet-select";
import { confirm } from "~/components/ui/confirm-dialog";
import { ProgressBar } from "~/components/ui/progress-bar";
import { StatCard } from "~/components/ui/stat-card";
import { useFinanceStore } from "~/store/useFinanceStore";
import { daysUntil, formatCurrency, formatDate } from "~/lib/utils";
import type { DebtContact, DebtDirection, DebtInstallment } from "~/lib/types";
import type {
  ContactListRow,
  DebtContactGroup,
  DebtListRow,
  DebtSummary,
} from "~/lib/people-pages";
import { Pagination } from "~/components/ui/pagination";
import { ServerListStatus } from "~/components/ui/server-paginated-list";
import { useServerPagination } from "~/lib/use-server-pagination";

type ActiveTab = "owe" | "lent";

const CONTACTS_STORAGE_KEY = "fintrack_debt_contacts";
const DELETED_CONTACTS_STORAGE_KEY = "fintrack_debt_deleted_contacts";

function loadSavedContacts(): DebtContact[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CONTACTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadDeletedContacts(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DELETED_CONTACTS_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function normalizeContactName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export default function DebtsPage() {
  const [debtWalletId, setDebtWalletId] = useState("");
  const [installmentWalletId, setInstallmentWalletId] = useState("");
  const addDebt = useFinanceStore((s) => s.addDebt);
  const deleteDebt = useFinanceStore((s) => s.deleteDebt);
  const addDebtInstallment = useFinanceStore((s) => s.addDebtInstallment);
  const updateDebtInstallment = useFinanceStore((s) => s.updateDebtInstallment);
  const deleteDebtInstallment = useFinanceStore((s) => s.deleteDebtInstallment);
  const [editingInstallmentId, setEditingInstallmentId] = useState<
    string | null
  >(null);
  const addDebtContact = useFinanceStore((s) => s.addDebtContact);
  const updateDebtContact = useFinanceStore((s) => s.updateDebtContact);
  const deleteDebtContact = useFinanceStore((s) => s.deleteDebtContact);
  const [activeTab, setActiveTab] = useState<ActiveTab>("owe");
  const [expandedContactKey, setExpandedContactKey] = useState<string | null>(
    null,
  );
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showInstallmentModal, setShowInstallmentModal] = useState<
    string | null
  >(null);

  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [contactPickerQuery, setContactPickerQuery] = useState("");
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  // client render must match. We populate it inside the effect below
  // to keep hydration text and DOM byte-identical.
  const [deletedContactNames, setDeletedContactNames] = useState<Set<string>>(
    () => new Set(),
  );
  useEffect(() => {
    setDeletedContactNames(loadDeletedContacts());
  }, []);
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({
    name: "",
    phone: "",
    note: "",
  });

  // One-time migration from legacy localStorage to store / database.
  // Runs strictly on mount — never again — so we don't keep adding the
  // same contact every time the store updates mid-session.
  useEffect(() => {
    const local = loadSavedContacts();
    if (local.length === 0) return;
    const existing = useFinanceStore.getState().debtContacts;
    for (const item of local) {
      const norm = normalizeContactName(item.name);
      if (!existing.some((c) => normalizeContactName(c.name) === norm)) {
        addDebtContact({
          name: item.name,
          phone: item.phone,
          note: item.note,
        });
      }
    }
    try {
      window.localStorage.removeItem(CONTACTS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    // Migration is intentionally fire-once; tracking deps would re-run
    // it on every store update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const contactPager = useServerPagination<ContactListRow>(
    "/debtContacts",
    {
      search: contactSearchQuery,
      excludeNames: JSON.stringify(Array.from(deletedContactNames)),
    },
    { resource: "debtContacts" },
  );
  const contactPickerPager = useServerPagination<ContactListRow>(
    "/debtContacts",
    {
      search: contactPickerQuery,
      excludeNames: JSON.stringify(Array.from(deletedContactNames)),
    },
    { resource: "debtContacts", pageSize: 8 },
  );
  const allContacts = contactPager.items;
  const debtContacts = allContacts.filter(
    (contact) => !contact.id.startsWith("debt-contact-"),
  );

  function handleSaveContact(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = contactForm.name.trim().replace(/\s+/g, " ");
    if (!cleanName) return;

    const phone = contactForm.phone.trim() || undefined;
    const note = contactForm.note.trim() || undefined;

    if (editingContactId) {
      if (!editingContactId.startsWith("debt-contact-")) {
        updateDebtContact(editingContactId, {
          name: cleanName,
          phone,
          note,
        });
      } else {
        addDebtContact({
          name: cleanName,
          phone,
          note,
        });
      }
      setEditingContactId(null);
    } else {
      const existing = debtContacts.find(
        (c) => normalizeContactName(c.name) === normalizeContactName(cleanName),
      );
      if (existing) {
        updateDebtContact(existing.id, {
          name: cleanName,
          phone: phone || existing.phone,
          note: note || existing.note,
        });
      } else {
        addDebtContact({
          name: cleanName,
          phone,
          note,
        });
      }

      const norm = normalizeContactName(cleanName);
      if (deletedContactNames.has(norm)) {
        setDeletedContactNames((prev) => {
          const next = new Set(prev);
          next.delete(norm);
          try {
            window.localStorage.setItem(
              DELETED_CONTACTS_STORAGE_KEY,
              JSON.stringify(Array.from(next)),
            );
          } catch {
            /* ignore */
          }
          return next;
        });
      }
    }

    setContactForm({ name: "", phone: "", note: "" });
  }

  async function handleDeleteContact(id: string) {
    const contactToDelete = allContacts.find((c) => c.id === id);
    if (!contactToDelete) return;
    if (
      !(await confirm({
        title: "Hapus kontak?",
        message: `Hapus ${contactToDelete.name} dari daftar kontak? Catatan utang tetap tersimpan.`,
        variant: "danger",
        confirmText: "Hapus kontak",
      }))
    )
      return;

    if (!id.startsWith("debt-contact-")) {
      deleteDebtContact(id);
    }

    const norm = normalizeContactName(contactToDelete.name);
    setDeletedContactNames((prev) => {
      const next = new Set(prev);
      next.add(norm);
      try {
        window.localStorage.setItem(
          DELETED_CONTACTS_STORAGE_KEY,
          JSON.stringify(Array.from(next)),
        );
      } catch {
        /* ignore */
      }
      return next;
    });
    if (selectedContactId === id) {
      setSelectedContactId("");
    }
  }
  const [debtForm, setDebtForm] = useState({
    direction: "owe" as DebtDirection,
    personName: "",
    contact: "",
    amount: "",
    dueDate: "",
    description: "",
  });
  const [installmentForm, setInstallmentForm] = useState({
    amount: "",
    date: "",
    note: "",
  });

  const groupPager = useServerPagination<DebtContactGroup, DebtSummary>(
    "/debts",
    { view: "groups", direction: activeTab },
  );
  const debtPager = useServerPagination<DebtListRow>(
    expandedContactKey ? "/debts" : null,
    { group: expandedContactKey },
    { resource: "debts" },
  );
  const installmentPager = useServerPagination<DebtInstallment>(
    expandedDebtId ? "/debts" : null,
    { view: "installments", debtId: expandedDebtId },
  );
  const debts = debtPager.items;
  const { totalOwe = 0, totalLent = 0, nett = 0 } = groupPager.summary ?? {};

  function handleDebtSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !selectedContactId ||
      !debtForm.personName ||
      !debtForm.amount ||
      !debtForm.description ||
      !debtWalletId
    ) {
      setContactPickerOpen(!selectedContactId);
      return;
    }

    const cleanName = debtForm.personName.trim().replace(/\s+/g, " ");
    const cleanContact = debtForm.contact.trim() || undefined;

    addDebt({
      walletId: debtWalletId,
      direction: debtForm.direction,
      personName: cleanName,
      personContact: cleanContact,
      amount: parseFloat(debtForm.amount),
      paidAmount: 0,
      dueDate: debtForm.dueDate
        ? new Date(debtForm.dueDate).toISOString()
        : undefined,
      description: debtForm.description,
      installments: [],
      isSettled: false,
      createdAt: new Date().toISOString(),
    });

    // Auto-save new contact if not exists in savedContacts
    const norm = normalizeContactName(cleanName);
    if (!debtContacts.some((c) => normalizeContactName(c.name) === norm)) {
      addDebtContact({
        name: cleanName,
        phone: cleanContact,
      });

      if (deletedContactNames.has(norm)) {
        setDeletedContactNames((prev) => {
          const next = new Set(prev);
          next.delete(norm);
          try {
            window.localStorage.setItem(
              DELETED_CONTACTS_STORAGE_KEY,
              JSON.stringify(Array.from(next)),
            );
          } catch {
            /* ignore */
          }
          return next;
        });
      }
    }

    setDebtForm({
      direction: "owe",
      personName: "",
      contact: "",
      amount: "",
      dueDate: "",
      description: "",
    });
    setSelectedContactId("");
    setContactPickerQuery("");
    setContactPickerOpen(false);
    setShowDebtModal(false);
  }

  function handleInstallmentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!showInstallmentModal || !installmentForm.amount) return;

    const amount = Number(installmentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const installment = {
      amount,
      walletId: installmentWalletId,
      date: installmentForm.date
        ? new Date(installmentForm.date).toISOString()
        : new Date().toISOString(),
      note: installmentForm.note,
    };
    if (!installmentWalletId) return;
    if (editingInstallmentId)
      updateDebtInstallment(
        showInstallmentModal,
        editingInstallmentId,
        installment,
      );
    else addDebtInstallment(showInstallmentModal, installment);
    setEditingInstallmentId(null);
    setInstallmentForm({ amount: "", date: "", note: "" });
    setShowInstallmentModal(null);
  }

  const df = (k: keyof typeof debtForm, v: string) =>
    setDebtForm((f) => ({ ...f, [k]: v }));

  function openDebtModal() {
    setDebtForm((f) => ({ ...f, direction: activeTab }));
    setSelectedContactId("");
    setContactPickerQuery("");
    setContactPickerOpen(false);
    setShowDebtModal(true);
    setDebtWalletId("");
  }

  const currentDebtForInstallment = debts.find(
    (d) => d.id === showInstallmentModal,
  );

  return (
    <PageWrapper
      title="Utang & Piutang"
      subtitle="Kelompokkan utang per kontak, detail transaksi tetap tersimpan"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Hutang Saya"
          value={
            <span className="text-danger tabular-nums">
              {formatCurrency(totalOwe)}
            </span>
          }
          subtitle="Belum dilunasi"
          icon={<Layers className="text-danger" />}
        />
        <StatCard
          title="Total Piutang Saya"
          value={
            <span className="text-success tabular-nums">
              {formatCurrency(totalLent)}
            </span>
          }
          subtitle="Orang lain hutang ke kamu"
          icon={<Layers className="text-success" />}
        />
        <StatCard
          title="Nett Posisi"
          value={
            <span
              className={`tabular-nums ${nett >= 0 ? "text-success" : "text-danger"}`}
            >
              {nett >= 0 ? "+" : ""}
              {formatCurrency(nett)}
            </span>
          }
          subtitle={
            nett >= 0
              ? "Kamu lebih banyak berpiutang"
              : "Kamu lebih banyak berhutang"
          }
          icon={<Layers className="text-primary" />}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="bg-bg-elevated flex gap-1 rounded-xl p-1">
          {(["owe", "lent"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-bg-surface text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab === "owe" ? "Hutang Saya" : "Piutang Saya"}
              <span className="bg-bg-base ml-2 rounded-full px-1.5 py-0.5 text-[10px]">
                {debts.filter((d) => d.direction === tab).length}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Users className="h-4 w-4" />}
            onClick={() => setShowContactModal(true)}
          >
            Kontak ({contactPager.total})
          </Button>
          <Button
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={openDebtModal}
          >
            {activeTab === "owe" ? "Tambah Hutang" : "Tambah Piutang"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <ServerListStatus {...groupPager} />
        {groupPager.items.map((group) => {
          const isExpanded = expandedContactKey === group.key;
          const activeCount = group.activeCount;
          const pct =
            group.amount > 0
              ? Math.round((group.paidAmount / group.amount) * 100)
              : 0;

          return (
            <Card key={group.key} className="group">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${group.remaining > 0 ? "border-primary/30 bg-primary/10 text-text-primary" : "border-success/30 bg-success/10 text-success"}`}
                >
                  {getInitials(group.personName)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-text-primary text-sm font-semibold">
                          {group.personName}
                        </h3>
                        <Badge
                          variant={group.remaining > 0 ? "warning" : "success"}
                          size="sm"
                        >
                          {group.remaining > 0
                            ? `${activeCount} aktif`
                            : "Lunas"}
                        </Badge>
                        <Badge variant="default" size="sm">
                          {group.debtCount} transaksi
                        </Badge>
                      </div>
                      {group.personContact && (
                        <p className="text-text-muted mt-0.5 text-xs">
                          {group.personContact}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-text-primary font-bold tabular-nums">
                        {formatCurrency(group.remaining)}
                      </p>
                      <p className="text-text-muted text-[10px] tabular-nums">
                        Total: {formatCurrency(group.amount)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1">
                    <div className="text-text-muted flex justify-between text-xs tabular-nums">
                      <span>Dibayar: {formatCurrency(group.paidAmount)}</span>
                      <span>{pct}%</span>
                    </div>
                    <ProgressBar
                      value={group.paidAmount}
                      max={group.amount}
                      color={activeTab === "owe" ? "#ef4444" : "#22c55e"}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setExpandedContactKey(isExpanded ? null : group.key)
                      }
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                      Detail Transaksi
                    </Button>
                    {group.personContact && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          window.open(
                            `https://wa.me/${group.personContact?.replace(/\D/g, "")}`,
                            "_blank",
                          )
                        }
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Kirim WA
                      </Button>
                    )}
                  </div>

                  {isExpanded && (
                    <>
                      <ServerListStatus {...debtPager} />
                      {!debtPager.loading &&
                        !debtPager.error &&
                        debtPager.total === 0 && (
                          <p className="text-text-muted mt-3 text-sm">
                            Tidak ada transaksi untuk kontak ini.
                          </p>
                        )}
                      <div className="border-border mt-4 space-y-3 border-l-2 pl-4">
                        {debtPager.items.map((debt) => {
                          const remaining = debt.amount - debt.paidAmount;
                          const debtPct = Math.round(
                            (debt.paidAmount / debt.amount) * 100,
                          );
                          const days = debt.dueDate
                            ? daysUntil(debt.dueDate)
                            : null;
                          const debtExpanded = expandedDebtId === debt.id;

                          return (
                            <div
                              key={debt.id}
                              className="bg-bg-elevated/60 rounded-xl p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-text-primary text-sm font-medium">
                                      {debt.description}
                                    </p>
                                    {debt.isSettled ? (
                                      <Badge variant="success" size="sm">
                                        Lunas
                                      </Badge>
                                    ) : (
                                      <Badge variant="warning" size="sm">
                                        Aktif
                                      </Badge>
                                    )}
                                    {debt.dueDate &&
                                      !debt.isSettled &&
                                      days !== null && (
                                        <Badge
                                          variant={
                                            days < 0
                                              ? "danger"
                                              : days <= 7
                                                ? "warning"
                                                : "default"
                                          }
                                          size="sm"
                                        >
                                          {days < 0
                                            ? `Terlambat ${Math.abs(days)} hr`
                                            : `${days} hr lagi`}
                                        </Badge>
                                      )}
                                  </div>
                                  <p className="text-text-muted mt-0.5 text-xs">
                                    Dibuat: {formatDate(debt.createdAt)}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-text-primary text-sm font-bold">
                                    {formatCurrency(debt.amount)}
                                  </p>
                                  <p className="text-text-muted text-[10px]">
                                    Sisa: {formatCurrency(remaining)}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-2 space-y-1">
                                <div className="text-text-muted flex justify-between text-xs">
                                  <span>
                                    Dibayar: {formatCurrency(debt.paidAmount)}
                                  </span>
                                  <span>{debtPct}%</span>
                                </div>
                                <ProgressBar
                                  value={debt.paidAmount}
                                  max={debt.amount}
                                  color={
                                    activeTab === "owe" ? "#ef4444" : "#22c55e"
                                  }
                                  size="sm"
                                />
                              </div>

                              {!debt.isSettled && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingInstallmentId(null);
                                      setInstallmentWalletId("");
                                      setInstallmentForm({
                                        amount: "",
                                        date: "",
                                        note: "",
                                      });
                                      setShowInstallmentModal(debt.id);
                                    }}
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    Catat Cicilan
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="success"
                                    onClick={() => {
                                      setEditingInstallmentId(null);
                                      setInstallmentWalletId("");
                                      setInstallmentForm({
                                        amount: String(
                                          Math.max(
                                            0,
                                            debt.amount - debt.paidAmount,
                                          ),
                                        ),
                                        date: "",
                                        note: "Pelunasan",
                                      });
                                      setShowInstallmentModal(debt.id);
                                    }}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    Lunas
                                  </Button>
                                  <button
                                    onClick={async () => {
                                      if (
                                        await confirm({
                                          title: "Hapus transaksi utang?",
                                          message:
                                            "Transaksi ini beserta seluruh catatan cicilannya akan dihapus.",
                                          variant: "danger",
                                          confirmText: "Hapus utang",
                                        })
                                      )
                                        deleteDebt(debt.id);
                                    }}
                                    className="text-text-muted hover:bg-danger/10 hover:text-danger flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                                    aria-label="Hapus transaksi utang"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}

                              {debt.installmentCount > 0 && (
                                <button
                                  onClick={() =>
                                    setExpandedDebtId(
                                      debtExpanded ? null : debt.id,
                                    )
                                  }
                                  className="text-text-muted hover:text-text-secondary mt-3 flex items-center gap-1.5 text-xs transition-colors"
                                >
                                  {debtExpanded ? (
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  )}
                                  {debt.installmentCount} catatan cicilan
                                </button>
                              )}

                              {debtExpanded && (
                                <>
                                  <ServerListStatus {...installmentPager} />
                                  {!installmentPager.loading &&
                                    !installmentPager.error &&
                                    installmentPager.total === 0 && (
                                      <p className="text-text-muted mt-3 text-sm">
                                        Belum ada catatan cicilan.
                                      </p>
                                    )}
                                  <div className="border-border mt-3 space-y-2 border-l-2 pl-4">
                                    {installmentPager.items.map((inst) => (
                                      <div
                                        key={inst.id}
                                        className="flex flex-wrap items-center justify-between gap-2 text-xs"
                                      >
                                        <div>
                                          <p className="text-text-secondary">
                                            {inst.note || "Pembayaran"}
                                          </p>
                                          <p className="text-text-muted">
                                            {formatDate(inst.date)}
                                          </p>
                                        </div>
                                        <span className="text-success font-semibold">
                                          +{formatCurrency(inst.amount)}
                                        </span>
                                        <div className="flex shrink-0 gap-1">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              setEditingInstallmentId(inst.id);
                                              setInstallmentWalletId(
                                                inst.walletId ?? "",
                                              );
                                              setInstallmentForm({
                                                amount: String(inst.amount),
                                                date: inst.date.slice(0, 10),
                                                note: inst.note ?? "",
                                              });
                                              setShowInstallmentModal(debt.id);
                                            }}
                                          >
                                            Edit
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={async () => {
                                              if (
                                                await confirm({
                                                  title: "Hapus cicilan?",
                                                  message: `Cicilan ${formatCurrency(inst.amount)} akan dihapus dan sisa utang dihitung ulang.`,
                                                  variant: "danger",
                                                  confirmText: "Hapus cicilan",
                                                })
                                              )
                                                deleteDebtInstallment(
                                                  debt.id,
                                                  inst.id,
                                                );
                                            }}
                                          >
                                            Hapus
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <Pagination
                                    {...installmentPager}
                                    label="cicilan"
                                  />
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <Pagination {...debtPager} label="utang/piutang" />
                    </>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {!groupPager.loading && !groupPager.error && groupPager.total === 0 && (
          <Card className="py-12 text-center">
            <Layers className="text-text-muted mx-auto mb-3 h-10 w-10" />
            <p className="text-text-muted text-sm">
              {activeTab === "owe"
                ? "Kamu tidak punya hutang"
                : "Belum ada piutang tercatat"}
            </p>
          </Card>
        )}
      </div>
      <Pagination {...groupPager} label="kelompok kontak" />

      <Modal
        open={showDebtModal}
        onClose={() => setShowDebtModal(false)}
        title={
          debtForm.direction === "owe" ? "Tambah Hutang" : "Tambah Piutang"
        }
      >
        <form onSubmit={handleDebtSubmit} className="space-y-4">
          <div className="flex gap-2">
            {(["owe", "lent"] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => df("direction", dir)}
                className={`flex-1 rounded-xl border-2 py-2.5 text-sm font-medium transition-colors ${
                  debtForm.direction === dir
                    ? dir === "owe"
                      ? "border-danger bg-danger/10 text-danger"
                      : "border-success bg-success/10 text-success"
                    : "border-border text-text-muted"
                }`}
              >
                {dir === "owe" ? "Saya Berhutang" : "Orang Lain Berhutang"}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="debt-contact-search"
                className="text-text-secondary text-xs font-medium"
              >
                Kontak
              </label>
              <button
                type="button"
                onClick={() => {
                  setContactPickerOpen(false);
                  setShowDebtModal(false);
                  setShowContactModal(true);
                }}
                className="text-primary hover:text-primary/80 flex min-h-11 items-center gap-1 text-xs font-medium"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Kelola kontak
              </button>
            </div>
            <div
              className="relative"
              onBlur={(event) => {
                if (
                  !(event.relatedTarget instanceof Node) ||
                  !event.currentTarget.contains(event.relatedTarget)
                )
                  setContactPickerOpen(false);
              }}
            >
              <div className="relative">
                <Search
                  aria-hidden
                  className="text-text-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                />
                <input
                  id="debt-contact-search"
                  type="search"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={contactPickerOpen}
                  aria-controls="debt-contact-options"
                  aria-label="Cari kontak tersimpan"
                  placeholder="Cari nama atau nomor telepon..."
                  value={contactPickerQuery}
                  onFocus={() => setContactPickerOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setContactPickerOpen(false);
                    }
                    if (event.key === "ArrowDown" && contactPickerOpen) {
                      event.preventDefault();
                      document
                        .querySelector<HTMLButtonElement>(
                          '#debt-contact-options [role="option"]',
                        )
                        ?.focus();
                    }
                    if (event.key === "Enter" && contactPickerOpen) {
                      event.preventDefault();
                      if (contactPickerPager.items.length === 1) {
                        const contact = contactPickerPager.items[0];
                        if (contact) {
                          setSelectedContactId(contact.id);
                          df("personName", contact.name);
                          df("contact", contact.phone || "");
                          setContactPickerQuery(contact.name);
                          setContactPickerOpen(false);
                        }
                      } else {
                        document
                          .querySelector<HTMLButtonElement>(
                            '#debt-contact-options [role="option"]',
                          )
                          ?.focus();
                      }
                    }
                  }}
                  onChange={(event) => {
                    setContactPickerQuery(event.target.value);
                    setContactPickerOpen(true);
                    setSelectedContactId("");
                    df("personName", "");
                    df("contact", "");
                  }}
                  className="bg-bg-surface border-text-muted text-text-primary placeholder:text-text-muted focus-visible:ring-primary h-11 w-full rounded-lg border pr-3 pl-10 text-sm focus-visible:ring-2 focus-visible:outline-none"
                />
              </div>
              {contactPickerOpen && (
                <div className="bg-bg-surface border-text-muted mt-1 max-h-56 overflow-y-auto rounded-lg border p-1 shadow-md">
                  <ServerListStatus {...contactPickerPager} />
                  <div
                    id="debt-contact-options"
                    role="listbox"
                    aria-label="Hasil pencarian kontak"
                  >
                    {!contactPickerPager.loading &&
                      !contactPickerPager.error &&
                      contactPickerPager.items.map((contact) => (
                        <button
                          key={contact.id}
                          type="button"
                          role="option"
                          aria-selected={selectedContactId === contact.id}
                          onKeyDown={(event) => {
                            if (event.key === "ArrowDown") {
                              event.preventDefault();
                              const next =
                                event.currentTarget.nextElementSibling;
                              if (next instanceof HTMLButtonElement)
                                next.focus();
                            }
                            if (event.key === "ArrowUp") {
                              event.preventDefault();
                              const previous =
                                event.currentTarget.previousElementSibling;
                              if (previous instanceof HTMLButtonElement)
                                previous.focus();
                              else
                                document
                                  .getElementById("debt-contact-search")
                                  ?.focus();
                            }
                          }}
                          onClick={() => {
                            setSelectedContactId(contact.id);
                            df("personName", contact.name);
                            df("contact", contact.phone || "");
                            setContactPickerQuery(contact.name);
                            setContactPickerOpen(false);
                          }}
                          className="hover:bg-bg-elevated focus-visible:bg-bg-elevated focus-visible:outline-primary flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm outline-none focus-visible:outline-2"
                        >
                          <span className="min-w-0">
                            <span className="text-text-primary block truncate font-medium">
                              {contact.name}
                            </span>
                            {(contact.phone || contact.note) && (
                              <span className="text-text-muted block truncate text-xs">
                                {[contact.phone, contact.note]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            )}
                          </span>
                          {selectedContactId === contact.id && (
                            <Check
                              aria-hidden
                              className="text-primary h-4 w-4 shrink-0"
                            />
                          )}
                        </button>
                      ))}
                  </div>
                  {!contactPickerPager.loading &&
                    !contactPickerPager.error &&
                    contactPickerPager.total === 0 && (
                      <p className="text-text-secondary px-3 py-3 text-sm">
                        {contactPickerQuery.trim()
                          ? "Kontak tidak ditemukan. Kelola kontak untuk menambahkan nama baru."
                          : "Belum ada kontak tersimpan. Tambahkan melalui Kelola kontak."}
                      </p>
                    )}
                  {contactPickerPager.totalPages > 1 && (
                    <Pagination {...contactPickerPager} label="hasil kontak" />
                  )}
                </div>
              )}
              {!selectedContactId && contactPickerQuery.trim() && (
                <p className="text-text-secondary mt-1 text-xs">
                  Pilih kontak dari hasil pencarian.
                </p>
              )}
            </div>
            {selectedContactId && (
              <p className="text-text-secondary text-xs">
                Kontak dipilih: {debtForm.personName}
                {debtForm.contact ? ` · ${debtForm.contact}` : ""}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Jumlah Transaksi (Rp)"
              currency
              type="number"
              placeholder="0"
              value={debtForm.amount}
              onChange={(e) => df("amount", e.target.value)}
              required
            />
            <DatePicker
              label="Jatuh Tempo (opsional)"
              value={debtForm.dueDate}
              onValueChange={(value) => df("dueDate", value)}
            />
          </div>
          <WalletSelect
            value={debtWalletId}
            onChange={setDebtWalletId}
            label={
              debtForm.direction === "owe"
                ? "Dompet penerima pinjaman"
                : "Dompet sumber pinjaman"
            }
          />
          <p className="text-text-secondary text-xs">
            {debtForm.direction === "owe"
              ? "Pinjaman menambah saldo dompet penerima."
              : "Uang yang dipinjamkan mengurangi saldo dompet sumber."}
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">
              Keterangan Transaksi
            </label>
            <textarea
              value={debtForm.description}
              onChange={(e) => df("description", e.target.value)}
              placeholder="cth. Pinjam bulan Januari"
              rows={2}
              required
              className="bg-bg-surface border-border text-text-primary placeholder:text-text-muted focus:ring-primary/50 w-full resize-none rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDebtModal(false)}
            >
              Batal
            </Button>
            <Button type="submit">Simpan</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!showInstallmentModal}
        onClose={() => setShowInstallmentModal(null)}
        title={`${editingInstallmentId ? "Edit Cicilan" : "Catat Cicilan"} - ${currentDebtForInstallment?.personName || ""}`}
      >
        <form onSubmit={handleInstallmentSubmit} className="space-y-4">
          <WalletSelect
            value={installmentWalletId}
            onChange={setInstallmentWalletId}
            label={
              currentDebtForInstallment?.direction === "lent"
                ? "Dompet penerima cicilan"
                : "Dompet pembayaran"
            }
          />
          {currentDebtForInstallment && (
            <div className="bg-bg-elevated space-y-1 rounded-lg p-3 text-xs">
              <div className="text-text-muted flex justify-between">
                <span>Total transaksi</span>
                <span>{formatCurrency(currentDebtForInstallment.amount)}</span>
              </div>
              <div className="text-text-muted flex justify-between">
                <span>Sudah dibayar</span>
                <span className="text-success">
                  {formatCurrency(currentDebtForInstallment.paidAmount)}
                </span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-text-primary">Sisa</span>
                <span className="text-warning">
                  {formatCurrency(
                    currentDebtForInstallment.amount -
                      currentDebtForInstallment.paidAmount,
                  )}
                </span>
              </div>
            </div>
          )}
          <Input
            label="Jumlah Cicilan (Rp)"
            currency
            type="number"
            min="1"
            placeholder="0"
            value={installmentForm.amount}
            onChange={(e) =>
              setInstallmentForm((f) => ({ ...f, amount: e.target.value }))
            }
            required
          />
          <DatePicker
            label="Tanggal"
            value={installmentForm.date}
            onValueChange={(value) =>
              setInstallmentForm((f) => ({ ...f, date: value }))
            }
          />
          <Input
            label="Catatan (opsional)"
            placeholder="cth. Bayar via transfer"
            value={installmentForm.note}
            onChange={(e) =>
              setInstallmentForm((f) => ({ ...f, note: e.target.value }))
            }
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowInstallmentModal(null)}
            >
              Batal
            </Button>
            <Button type="submit">
              {editingInstallmentId ? "Simpan Perubahan" : "Catat Cicilan"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showContactModal}
        onClose={() => {
          setShowContactModal(false);
          setEditingContactId(null);
          setContactForm({ name: "", phone: "", note: "" });
        }}
        title="Kelola Kontak Utang & Piutang"
        size="lg"
      >
        <div className="space-y-5">
          <div className="bg-bg-elevated/60 border-border rounded-xl border p-4">
            <h4 className="text-text-primary mb-3 text-xs font-semibold tracking-wider uppercase">
              {editingContactId ? "Perbarui Kontak" : "Tambah Kontak Baru"}
            </h4>
            <form onSubmit={handleSaveContact} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input
                  label="Nama Kontak"
                  placeholder="cth. Ahmad Fauzi"
                  value={contactForm.name}
                  onChange={(e) =>
                    setContactForm((f) => ({ ...f, name: e.target.value }))
                  }
                  required
                />
                <Input
                  label="Nomor WhatsApp / HP"
                  placeholder="0812..."
                  value={contactForm.phone}
                  onChange={(e) =>
                    setContactForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
                <Input
                  label="Catatan (opsional)"
                  placeholder="cth. Teman Kantor"
                  value={contactForm.note}
                  onChange={(e) =>
                    setContactForm((f) => ({ ...f, note: e.target.value }))
                  }
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                {editingContactId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingContactId(null);
                      setContactForm({ name: "", phone: "", note: "" });
                    }}
                  >
                    Batal Edit
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  leftIcon={
                    editingContactId ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )
                  }
                >
                  {editingContactId ? "Simpan Perubahan" : "Simpan Kontak"}
                </Button>
              </div>
            </form>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="text-text-primary text-sm font-semibold">
                Daftar Kontak ({contactPager.total})
              </h4>
              <div className="relative w-full sm:w-64">
                <Search className="text-text-muted absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari kontak..."
                  value={contactSearchQuery}
                  onChange={(e) => setContactSearchQuery(e.target.value)}
                  className="bg-bg-surface border-border text-text-primary placeholder:text-text-muted focus:ring-primary/50 w-full rounded-lg border py-1.5 pr-7 pl-8 text-xs focus:ring-2 focus:outline-none"
                />
                {contactSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setContactSearchQuery("")}
                    className="text-text-muted hover:text-text-primary absolute top-1/2 right-2 -translate-y-1/2"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              <ServerListStatus {...contactPager} />
              {contactPager.items.map((contact) => {
                const oweTotal = contact.oweTotal;
                const lentTotal = contact.lentTotal;

                return (
                  <div
                    key={contact.id}
                    className="border-border bg-bg-surface hover:bg-bg-elevated/40 flex flex-col gap-3 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                        {getInitials(contact.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-text-primary truncate text-sm font-semibold">
                            {contact.name}
                          </p>
                          {contact.note && (
                            <span className="bg-bg-elevated text-text-muted rounded px-1.5 py-0.5 text-[10px]">
                              {contact.note}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                          {contact.phone ? (
                            <span className="text-text-muted flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {contact.phone}
                            </span>
                          ) : (
                            <span className="text-text-muted text-[11px] italic">
                              Tanpa nomor HP
                            </span>
                          )}
                          {oweTotal > 0 && (
                            <span className="text-danger font-medium tabular-nums">
                              Hutang: {formatCurrency(oweTotal)}
                            </span>
                          )}
                          {lentTotal > 0 && (
                            <span className="text-success font-medium tabular-nums">
                              Piutang: {formatCurrency(lentTotal)}
                            </span>
                          )}
                          {oweTotal === 0 && lentTotal === 0 && (
                            <span className="text-text-muted text-[11px]">
                              Tidak ada tanggungan aktif
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-center">
                      {contact.phone && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-[#25D366] hover:bg-[#25D366]/10"
                          title="Kirim WhatsApp"
                          onClick={() =>
                            window.open(
                              `https://wa.me/${contact.phone?.replace(/\D/g, "")}`,
                              "_blank",
                            )
                          }
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs"
                        onClick={() => {
                          setShowContactModal(false);
                          setDebtForm((f) => ({
                            ...f,
                            direction: activeTab,
                            personName: contact.name,
                            contact: contact.phone || "",
                          }));
                          setSelectedContactId(contact.id);
                          setShowDebtModal(true);
                        }}
                      >
                        + Catat
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-text-muted hover:text-text-primary h-8 w-8 p-0"
                        title="Edit Kontak"
                        onClick={() => {
                          setEditingContactId(contact.id);
                          setContactForm({
                            name: contact.name,
                            phone: contact.phone || "",
                            note: contact.note || "",
                          });
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-text-muted hover:text-danger h-8 w-8 p-0"
                        title="Hapus Kontak"
                        onClick={() => handleDeleteContact(contact.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {!contactPager.loading &&
                !contactPager.error &&
                contactPager.total === 0 && (
                  <div className="border-border bg-bg-elevated/30 rounded-xl border border-dashed py-8 text-center">
                    <Users className="text-text-muted mx-auto mb-2 h-8 w-8" />
                    <p className="text-text-muted text-xs">
                      {contactSearchQuery
                        ? "Tidak ada kontak yang cocok dengan pencarian"
                        : "Belum ada kontak tersimpan. Gunakan formulir di atas untuk menambah kontak baru."}
                    </p>
                  </div>
                )}
            </div>
            <Pagination {...contactPager} label="kontak" />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowContactModal(false);
                setEditingContactId(null);
                setContactForm({ name: "", phone: "", note: "" });
              }}
            >
              Tutup
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
