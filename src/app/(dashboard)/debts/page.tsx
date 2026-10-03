"use client";

import { useEffect, useMemo, useState } from "react";
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
import { ProgressBar } from "~/components/ui/progress-bar";
import { StatCard } from "~/components/ui/stat-card";
import { useFinanceStore } from "~/store/useFinanceStore";
import { daysUntil, formatCurrency, formatDate } from "~/lib/utils";
import type { Debt, DebtContact, DebtDirection } from "~/lib/types";

type ActiveTab = "owe" | "lent";

interface DebtContactGroup {
  key: string;
  personName: string;
  personContact?: string;
  debts: Debt[];
  amount: number;
  paidAmount: number;
  remaining: number;
}

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

function saveContactsToStorage(contacts: DebtContact[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
  } catch {
    /* ignore */
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

function contactKey(debt: Debt) {
  return `${debt.direction}:${normalizeContactName(debt.personName)}`;
}

export default function DebtsPage() {
  const debts = useFinanceStore((s) => s.debts);
  const addDebt = useFinanceStore((s) => s.addDebt);
  const deleteDebt = useFinanceStore((s) => s.deleteDebt);
  const addDebtInstallment = useFinanceStore((s) => s.addDebtInstallment);
  const settleDebt = useFinanceStore((s) => s.settleDebt);
  const debtContacts = useFinanceStore((s) => s.debtContacts);
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
  // Read on mount only — the SSR sees an empty Set, so the first
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

  const allContacts = useMemo(() => {
    const map = new Map<string, DebtContact>();

    for (const c of debtContacts) {
      const norm = normalizeContactName(c.name);
      if (norm && !deletedContactNames.has(norm)) {
        map.set(norm, c);
      }
    }

    for (const d of debts) {
      const norm = normalizeContactName(d.personName);
      if (norm && !deletedContactNames.has(norm) && !map.has(norm)) {
        map.set(norm, {
          id: `debt-contact-${norm}`,
          name: d.personName.trim().replace(/\s+/g, " "),
          phone: d.personContact?.trim() || undefined,
          createdAt: d.createdAt || new Date().toISOString(),
        });
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "id"),
    );
  }, [debtContacts, debts, deletedContactNames]);

  const filteredContactsList = useMemo(() => {
    if (!contactSearchQuery.trim()) return allContacts;
    const q = contactSearchQuery.toLowerCase();
    return allContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.note && c.note.toLowerCase().includes(q)),
    );
  }, [allContacts, contactSearchQuery]);

  function handleSaveContact(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = contactForm.name.trim().replace(/\s+/g, " ");
    if (!cleanName) return;

    const phone = contactForm.phone.trim() || undefined;
    const note = contactForm.note.trim() || undefined;

    if (editingContactId) {
      const existingInStore = debtContacts.find(
        (c) => c.id === editingContactId,
      );
      if (existingInStore) {
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

  function handleDeleteContact(id: string) {
    const contactToDelete = allContacts.find((c) => c.id === id);
    if (!contactToDelete) return;

    if (debtContacts.some((c) => c.id === id)) {
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

  const filteredDebts = useMemo(
    () => debts.filter((d) => d.direction === activeTab),
    [debts, activeTab],
  );

  const groupedDebts = useMemo(() => {
    const map = new Map<string, DebtContactGroup>();

    for (const debt of filteredDebts) {
      const key = contactKey(debt);
      const group = map.get(key) ?? {
        key,
        personName: debt.personName,
        personContact: debt.personContact,
        debts: [],
        amount: 0,
        paidAmount: 0,
        remaining: 0,
      };

      group.debts.push(debt);
      group.amount += debt.amount;
      group.paidAmount += debt.paidAmount;
      if (!debt.isSettled) group.remaining += debt.amount - debt.paidAmount;
      if (!group.personContact && debt.personContact)
        group.personContact = debt.personContact;
      map.set(key, group);
    }

    return Array.from(map.values()).sort((a, b) => b.remaining - a.remaining);
  }, [filteredDebts]);

  const { totalOwe, totalLent, nett } = useMemo(() => {
    const totalOwe = debts
      .filter((d) => d.direction === "owe" && !d.isSettled)
      .reduce((s, d) => s + (d.amount - d.paidAmount), 0);
    const totalLent = debts
      .filter((d) => d.direction === "lent" && !d.isSettled)
      .reduce((s, d) => s + (d.amount - d.paidAmount), 0);
    return { totalOwe, totalLent, nett: totalLent - totalOwe };
  }, [debts]);

  function handleDebtSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!debtForm.personName || !debtForm.amount || !debtForm.description)
      return;

    const cleanName = debtForm.personName.trim().replace(/\s+/g, " ");
    const cleanContact = debtForm.contact.trim() || undefined;

    addDebt({
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
    setShowDebtModal(false);
  }

  function handleInstallmentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!showInstallmentModal || !installmentForm.amount) return;

    addDebtInstallment(showInstallmentModal, {
      amount: parseFloat(installmentForm.amount),
      date: installmentForm.date
        ? new Date(installmentForm.date).toISOString()
        : new Date().toISOString(),
      note: installmentForm.note || undefined,
    });
    setInstallmentForm({ amount: "", date: "", note: "" });
    setShowInstallmentModal(null);
  }

  const df = (k: keyof typeof debtForm, v: string) =>
    setDebtForm((f) => ({ ...f, [k]: v }));

  function openDebtModal() {
    setDebtForm((f) => ({ ...f, direction: activeTab }));
    setSelectedContactId("");
    setShowDebtModal(true);
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
            Kontak ({allContacts.length})
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
        {groupedDebts.map((group) => {
          const isExpanded = expandedContactKey === group.key;
          const activeCount = group.debts.filter((d) => !d.isSettled).length;
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
                          {group.debts.length} transaksi
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
                    <div className="border-border mt-4 space-y-3 border-l-2 pl-4">
                      {group.debts.map((debt) => {
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
                                  onClick={() =>
                                    setShowInstallmentModal(debt.id)
                                  }
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Catat Cicilan
                                </Button>
                                <Button
                                  size="sm"
                                  variant="success"
                                  onClick={() => settleDebt(debt.id)}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Lunas
                                </Button>
                                <button
                                  onClick={() => deleteDebt(debt.id)}
                                  className="text-text-muted hover:bg-danger/10 hover:text-danger flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                                  aria-label="Hapus transaksi utang"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}

                            {debt.installments.length > 0 && (
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
                                {debt.installments.length} catatan cicilan
                              </button>
                            )}

                            {debtExpanded && (
                              <div className="border-border mt-3 space-y-2 border-l-2 pl-4">
                                {debt.installments.map((inst) => (
                                  <div
                                    key={inst.id}
                                    className="flex items-center justify-between text-xs"
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
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {groupedDebts.length === 0 && (
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
              <label className="text-text-secondary text-xs font-medium">
                Pilih Kontak Tersimpan
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowDebtModal(false);
                  setShowContactModal(true);
                }}
                className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs font-medium"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Kelola Kontak
              </button>
            </div>
            <select
              value={selectedContactId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedContactId(id);
                if (!id) {
                  df("personName", "");
                  df("contact", "");
                  return;
                }
                const found = allContacts.find((c) => c.id === id);
                if (found) {
                  df("personName", found.name);
                  df("contact", found.phone || "");
                }
              }}
              className="bg-bg-surface border-border text-text-primary focus:ring-primary/50 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            >
              <option value="">
                Pilih kontak ({allContacts.length}) atau ketik manual di bawah
              </option>
              {allContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ""} {c.note ? `(${c.note})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nama Kontak"
              placeholder="cth. Ahmad Fauzi"
              value={debtForm.personName}
              onChange={(e) => {
                df("personName", e.target.value);
                const match = allContacts.find(
                  (c) =>
                    normalizeContactName(c.name) ===
                    normalizeContactName(e.target.value),
                );
                setSelectedContactId(match ? match.id : "");
              }}
              required
            />
            <Input
              label="Kontak (WA)"
              placeholder="0812..."
              value={debtForm.contact}
              onChange={(e) => df("contact", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
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
        title={`Catat Cicilan - ${currentDebtForInstallment?.personName || ""}`}
      >
        <form onSubmit={handleInstallmentSubmit} className="space-y-4">
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
            <Button type="submit">Catat Cicilan</Button>
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
            <h4 className="text-text-primary mb-3 text-xs font-semibold uppercase tracking-wider">
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
                Daftar Kontak ({filteredContactsList.length})
              </h4>
              <div className="relative w-full sm:w-64">
                <Search className="text-text-muted absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari kontak..."
                  value={contactSearchQuery}
                  onChange={(e) => setContactSearchQuery(e.target.value)}
                  className="bg-bg-surface border-border text-text-primary placeholder:text-text-muted focus:ring-primary/50 w-full rounded-lg border py-1.5 pl-8 pr-7 text-xs focus:ring-2 focus:outline-none"
                />
                {contactSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setContactSearchQuery("")}
                    className="text-text-muted hover:text-text-primary absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {filteredContactsList.map((contact) => {
                const normName = normalizeContactName(contact.name);
                const relatedDebts = debts.filter(
                  (d) =>
                    normalizeContactName(d.personName) === normName &&
                    !d.isSettled,
                );
                const oweTotal = relatedDebts
                  .filter((d) => d.direction === "owe")
                  .reduce((s, d) => s + (d.amount - d.paidAmount), 0);
                const lentTotal = relatedDebts
                  .filter((d) => d.direction === "lent")
                  .reduce((s, d) => s + (d.amount - d.paidAmount), 0);

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

              {filteredContactsList.length === 0 && (
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
