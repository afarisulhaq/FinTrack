"use client";

import { useEffect, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as Switch from "@radix-ui/react-switch";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Bell,
  Check,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  FileJson,
  FileSpreadsheet,
  FileText,
  Key,
  Loader2,
  LogOut,
  Mail,
  MessageSquare,
  Monitor,
  Phone,
  Plus,
  QrCode,
  Send,
  Shield,
  Smartphone,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardBody, CardHeader } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Modal } from "~/components/ui/modal";
import { confirm } from "~/components/ui/confirm-dialog";
import { QrisImageUpload } from "~/components/qris/qris-image-upload";
import { useFinanceStore } from "~/store/useFinanceStore";
import { useAppConfigStore } from "~/store/useAppConfigStore";
import { getApiBaseUrl } from "~/lib/api";
import { cn } from "~/lib/utils";
import type { NotificationSettings, TeamMember, UserRole } from "~/lib/types";

// ─── Reusable micro-components ────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        "inline-flex h-6 w-11 cursor-pointer items-center rounded-full p-0.5",
        "transition-colors duration-200",
        "focus-visible:ring-primary/50 focus:outline-none focus-visible:ring-2",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-bg-elevated",
      )}
    >
      <Switch.Thumb
        className={cn(
          "block h-5 w-5 rounded-full bg-white shadow-sm",
          "transition-transform duration-200",
          "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
        )}
      />
    </Switch.Root>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-text-muted mb-3 text-xs font-semibold tracking-wider uppercase">
      {children}
    </h4>
  );
}

function FormRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 sm:items-start">
      <div className="pt-2">
        <label className="text-text-secondary text-sm font-medium">
          {label}
        </label>
        {hint && (
          <p className="text-text-muted mt-0.5 text-xs leading-tight">{hint}</p>
        )}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

function StyledSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "border-border bg-bg-surface w-full appearance-none rounded-lg border",
          "text-text-primary h-10 px-3 pr-8 text-sm",
          "transition-all duration-200",
          "focus:ring-primary/50 focus:border-primary focus:ring-2 focus:outline-none",
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="text-text-muted pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2" />
    </div>
  );
}

function PrefRow({
  label,
  description,
  checked,
  onCheckedChange,
  children,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-text-primary text-sm font-medium">{label}</p>
          {description && (
            <p className="text-text-muted text-xs">{description}</p>
          )}
        </div>
        <ToggleSwitch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
      {checked && children && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.15 }}
          className="overflow-hidden"
        >
          <div className="pt-1 pl-0">{children}</div>
        </motion.div>
      )}
    </div>
  );
}

// ─── Tab label definitions ────────────────────────────────────────────────────

const TAB_ITEMS = [
  { value: "profil", label: "Profil", icon: User },
  { value: "qris", label: "QRIS", icon: QrCode },
  { value: "tim", label: "Anggota Tim", icon: Users },
  { value: "notifikasi", label: "Notifikasi", icon: Bell },
  { value: "keamanan", label: "Keamanan", icon: Shield },
  { value: "data", label: "Data & Ekspor", icon: Download },
];

// ─── Static QR pattern (avoids Math.random in render) ────────────────────────

const QR_PATTERN: boolean[] = [
  true,
  false,
  true,
  false,
  true,
  true,
  false,
  true,
  false,
  false,
  true,
  true,
  false,
  false,
  true,
  false,
  true,
  true,
  false,
  true,
  false,
  true,
  false,
  true,
  true,
];

// ─── Mock data for Security tab ───────────────────────────────────────────────

interface ActiveSession {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
  icon: "desktop" | "mobile";
}

interface ActivityLog {
  id: string;
  date: string;
  device: string;
  ip: string;
  action: string;
}

const MOCK_SESSIONS: ActiveSession[] = [
  {
    id: "s1",
    device: "Chrome on Windows",
    location: "Jakarta, ID",
    lastActive: "Sekarang",
    current: true,
    icon: "desktop",
  },
  {
    id: "s2",
    device: "Firefox on Android",
    location: "Bandung, ID",
    lastActive: "2 jam lalu",
    current: false,
    icon: "mobile",
  },
  {
    id: "s3",
    device: "Safari on iPhone",
    location: "Surabaya, ID",
    lastActive: "1 hari lalu",
    current: false,
    icon: "mobile",
  },
];

const MOCK_ACTIVITY: ActivityLog[] = [
  {
    id: "a1",
    date: "07 Jun 2026, 08:45",
    device: "Chrome Windows",
    ip: "103.xxx.xxx.10",
    action: "Login",
  },
  {
    id: "a2",
    date: "06 Jun 2026, 18:20",
    device: "Firefox Android",
    ip: "114.xxx.xxx.55",
    action: "Login",
  },
  {
    id: "a3",
    date: "05 Jun 2026, 09:00",
    device: "Safari iPhone",
    ip: "202.xxx.xxx.91",
    action: "Login",
  },
  {
    id: "a4",
    date: "04 Jun 2026, 12:35",
    device: "Chrome Windows",
    ip: "103.xxx.xxx.10",
    action: "Ubah Password",
  },
];

const BACKUP_CODES = [
  "XKPQ-7821",
  "MNRT-4492",
  "BVWZ-6610",
  "LDJH-2237",
  "YCFS-9985",
  "AQEP-1174",
];

// ─── Tab 1: Profil ────────────────────────────────────────────────────────────

function ProfilTab() {
  const { userProfile, updateUserProfile } = useFinanceStore();

  const [form, setForm] = useState({
    name: userProfile.name,
    email: userProfile.email,
    phone: userProfile.phone ?? "",
    monthlyIncome: String(userProfile.monthlyIncome ?? ""),
    disposableIncome: String(userProfile.disposableIncome ?? ""),
    currency: userProfile.currency,
    language: userProfile.language,
    timezone: userProfile.timezone,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function fld<K extends keyof typeof form>(key: K) {
    return (value: string) => setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    setSaving(true);
    setTimeout(() => {
      updateUserProfile({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        monthlyIncome: form.monthlyIncome
          ? Number(form.monthlyIncome)
          : undefined,
        disposableIncome: form.disposableIncome
          ? Number(form.disposableIncome)
          : undefined,
        currency: form.currency,
        language: form.language,
        timezone: form.timezone,
      });
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }, 800);
  }

  const initials = form.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-5">
      {/* Avatar Section */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-5">
            <div className="bg-primary/20 text-primary border-primary/30 flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 text-2xl font-bold">
              {initials}
            </div>
            <div>
              <p className="text-text-primary font-semibold">{form.name}</p>
              <p className="text-text-muted text-sm">{form.email}</p>
              <p className="text-text-muted mt-1 text-xs">
                Bergabung{" "}
                {new Date(userProfile.joinedAt).toLocaleDateString("id-ID", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="ml-auto">
              <Button variant="outline" size="sm">
                Ubah Foto
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader>
          <p className="text-text-primary font-semibold">Informasi Pribadi</p>
        </CardHeader>
        <CardBody className="space-y-5">
          <FormRow label="Nama Lengkap">
            <Input
              value={form.name}
              onChange={(e) => fld("name")(e.target.value)}
              placeholder="Nama lengkap"
            />
          </FormRow>

          <FormRow label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => fld("email")(e.target.value)}
              placeholder="email@contoh.com"
              leftIcon={<Mail className="h-4 w-4" />}
            />
          </FormRow>

          <FormRow label="No. WhatsApp">
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => fld("phone")(e.target.value)}
              placeholder="+62 812 xxxx xxxx"
              leftIcon={<Phone className="h-4 w-4" />}
            />
          </FormRow>

          <div className="border-border border-t pt-5">
            <SectionTitle>Keuangan</SectionTitle>
            <div className="space-y-5">
              <FormRow
                label="Pendapatan Bulanan"
                hint="Gaji atau penghasilan per bulan"
              >
                <Input
                  type="number"
                  value={form.monthlyIncome}
                  onChange={(e) => fld("monthlyIncome")(e.target.value)}
                  placeholder="0"
                  leftIcon={
                    <span className="text-text-muted text-xs font-medium">
                      Rp
                    </span>
                  }
                />
              </FormRow>

              <FormRow
                label="Disposable Income"
                hint="Uang sisa setelah kebutuhan pokok"
              >
                <Input
                  type="number"
                  value={form.disposableIncome}
                  onChange={(e) => fld("disposableIncome")(e.target.value)}
                  placeholder="0"
                  leftIcon={
                    <span className="text-text-muted text-xs font-medium">
                      Rp
                    </span>
                  }
                />
                {form.monthlyIncome && form.disposableIncome && (
                  <p className="text-text-muted mt-1 text-xs">
                    {Math.round(
                      (Number(form.disposableIncome) /
                        Number(form.monthlyIncome)) *
                        100,
                    )}
                    % dari pendapatan bulanan
                  </p>
                )}
              </FormRow>
            </div>
          </div>

          <div className="border-border border-t pt-5">
            <SectionTitle>Preferensi</SectionTitle>
            <div className="space-y-5">
              <FormRow label="Mata Uang">
                <StyledSelect
                  value={form.currency}
                  onChange={fld("currency")}
                  options={[
                    { value: "IDR", label: "IDR — Rupiah Indonesia" },
                    { value: "USD", label: "USD — US Dollar" },
                    { value: "SGD", label: "SGD — Singapore Dollar" },
                    { value: "MYR", label: "MYR — Malaysian Ringgit" },
                  ]}
                />
              </FormRow>

              <FormRow label="Bahasa">
                <StyledSelect
                  value={form.language}
                  onChange={fld("language")}
                  options={[
                    { value: "id", label: "Indonesia" },
                    { value: "en", label: "English" },
                  ]}
                />
              </FormRow>

              <FormRow label="Zona Waktu">
                <StyledSelect
                  value={form.timezone}
                  onChange={fld("timezone")}
                  options={[
                    { value: "Asia/Jakarta", label: "WIB — Asia/Jakarta" },
                    { value: "Asia/Singapore", label: "SGT — Asia/Singapore" },
                    {
                      value: "Asia/Kuala_Lumpur",
                      label: "MYT — Asia/Kuala_Lumpur",
                    },
                  ]}
                />
              </FormRow>
            </div>
          </div>

          <div className="border-border flex items-center justify-between border-t pt-5">
            <AnimatePresence>
              {saved && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-success flex items-center gap-1.5 text-sm"
                >
                  <Check className="h-4 w-4" />
                  Perubahan disimpan
                </motion.div>
              )}
            </AnimatePresence>
            <div className="ml-auto">
              <Button
                loading={saving}
                onClick={handleSave}
                leftIcon={!saving ? <Check className="h-4 w-4" /> : undefined}
              >
                Simpan Perubahan
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Danger zone */}
      <Card className="border-danger/30">
        <CardHeader>
          <p className="text-danger font-semibold">Zona Berbahaya</p>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-text-primary text-sm font-medium">
                Hapus Akun
              </p>
              <p className="text-text-muted text-xs">
                Tindakan ini tidak dapat dibatalkan
              </p>
            </div>
            <div title="Hubungi support untuk menghapus akun">
              <Button variant="danger" size="sm" disabled>
                Hapus Akun
              </Button>
            </div>
          </div>
          <p className="text-text-muted mt-2 text-xs">
            💡 Untuk menghapus akun, silakan hubungi support kami.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

// ─── Tab 2: Anggota Tim ───────────────────────────────────────────────────────

interface InviteForm {
  email: string;
  role: Exclude<UserRole, "owner">;
  canViewAllWallets: boolean;
  canAddTransactions: boolean;
  canManageBudgets: boolean;
  walletIds: string[];
}

const EMPTY_INVITE: InviteForm = {
  email: "",
  role: "member",
  canViewAllWallets: false,
  canAddTransactions: true,
  canManageBudgets: false,
  walletIds: [],
};

const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Pemilik",
  member: "Anggota",
  viewer: "Penonton",
};

const ROLE_BADGE_VARIANT: Record<UserRole, "success" | "purple" | "default"> = {
  owner: "success",
  member: "purple",
  viewer: "default",
};

const STATUS_VARIANT: Record<
  TeamMember["status"],
  "success" | "warning" | "default"
> = {
  active: "success",
  invited: "warning",
  inactive: "default",
};

const STATUS_LABELS: Record<TeamMember["status"], string> = {
  active: "Aktif",
  invited: "Diundang",
  inactive: "Nonaktif",
};

function MemberInitials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="bg-primary/20 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold">
      {initials}
    </div>
  );
}

function AnggotaTimTab() {
  const {
    userProfile,
    teamMembers,
    addTeamMember,
    removeTeamMember,
    updateTeamMember,
    wallets,
  } = useFinanceStore();
  const { config } = useAppConfigStore();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>(EMPTY_INVITE);
  const [inviting, setInviting] = useState(false);

  // Flatten wallets (parent + children)
  const allWallets = wallets.flatMap((w) => [w, ...(w.children ?? [])]);

  function handleInvite() {
    if (!inviteForm.email) return;
    setInviting(true);
    setTimeout(() => {
      addTeamMember({
        name: inviteForm.email.split("@")[0],
        email: inviteForm.email,
        role: inviteForm.role,
        permissions: {
          canViewAllWallets: inviteForm.canViewAllWallets,
          canAddTransactions: inviteForm.canAddTransactions,
          canManageBudgets: inviteForm.canManageBudgets,
          walletIds: inviteForm.walletIds,
        },
        status: "invited",
        joinedAt: new Date().toISOString(),
        invitedAt: new Date().toISOString(),
      });
      setInviting(false);
      setShowInviteModal(false);
      setInviteForm(EMPTY_INVITE);
    }, 800);
  }

  function toggleWalletId(id: string) {
    setInviteForm((f) => ({
      ...f,
      walletIds: f.walletIds.includes(id)
        ? f.walletIds.filter((w) => w !== id)
        : [...f.walletIds, id],
    }));
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-text-primary font-semibold">Manajemen Anggota</h3>
          <p className="text-text-muted text-sm">
            {1 + teamMembers.length} anggota di tim ini
          </p>
        </div>
        <Button
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setShowInviteModal(true)}
        >
          Undang Anggota
        </Button>
      </div>

      {/* Owner card */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center gap-4">
            <MemberInitials name={userProfile.name} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-text-primary font-medium">
                  {userProfile.name}
                </p>
                <Badge variant="success">Pemilik</Badge>
                <Badge variant="success" size="sm">
                  Aktif
                </Badge>
              </div>
              <p className="text-text-muted mt-0.5 text-sm">
                {userProfile.email}
              </p>
            </div>
            <div className="text-text-muted flex flex-wrap gap-2 text-xs">
              <span className="bg-bg-elevated flex items-center gap-1 rounded-md px-2 py-1">
                👁 Lihat semua
              </span>
              <span className="bg-bg-elevated flex items-center gap-1 rounded-md px-2 py-1">
                ➕ Tambah transaksi
              </span>
              <span className="bg-bg-elevated flex items-center gap-1 rounded-md px-2 py-1">
                📊 Kelola anggaran
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Team member cards */}
      {teamMembers.map((member) => (
        <Card key={member.id}>
          <CardBody>
            <div className="flex flex-wrap items-start gap-4">
              <MemberInitials name={member.name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-text-primary font-medium">{member.name}</p>
                  <Badge variant={ROLE_BADGE_VARIANT[member.role]}>
                    {ROLE_LABELS[member.role]}
                  </Badge>
                  <Badge variant={STATUS_VARIANT[member.status]} size="sm">
                    {STATUS_LABELS[member.status]}
                  </Badge>
                </div>
                <p className="text-text-muted mt-0.5 text-sm">{member.email}</p>
                {member.phone && (
                  <p className="text-text-muted text-xs">{member.phone}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {member.permissions.canViewAllWallets && (
                    <span className="bg-bg-elevated text-text-muted rounded-md px-2 py-0.5 text-xs">
                      👁 Lihat semua
                    </span>
                  )}
                  {member.permissions.canAddTransactions && (
                    <span className="bg-bg-elevated text-text-muted rounded-md px-2 py-0.5 text-xs">
                      ➕ Tambah transaksi
                    </span>
                  )}
                  {member.permissions.canManageBudgets && (
                    <span className="bg-bg-elevated text-text-muted rounded-md px-2 py-0.5 text-xs">
                      📊 Kelola anggaran
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={member.role}
                    onChange={(e) =>
                      updateTeamMember(member.id, {
                        role: e.target.value as UserRole,
                      })
                    }
                    className={cn(
                      "border-border bg-bg-elevated appearance-none rounded-lg border",
                      "text-text-primary h-8 pr-7 pl-3 text-xs",
                      "focus:ring-primary/50 focus:ring-2 focus:outline-none",
                    )}
                  >
                    <option value="member">Anggota</option>
                    <option value="viewer">Penonton</option>
                  </select>
                  <ChevronDown className="text-text-muted pointer-events-none absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2" />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:bg-danger/10 hover:text-danger"
                  onClick={() => removeTeamMember(member.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      ))}

      {teamMembers.length === 0 && (
        <div className="border-border flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
          <Users className="text-text-muted h-8 w-8" />
          <p className="text-text-muted text-sm">Belum ada anggota tim</p>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setShowInviteModal(true)}
          >
            Undang Anggota
          </Button>
        </div>
      )}

      {/* Invite Modal */}
      <Modal
        open={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          setInviteForm(EMPTY_INVITE);
        }}
        title="Undang Anggota"
        description={`Kirim undangan bergabung ke tim ${config.appName} Anda`}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Alamat Email"
            type="email"
            value={inviteForm.email}
            onChange={(e) =>
              setInviteForm((f) => ({ ...f, email: e.target.value }))
            }
            placeholder="anggota@email.com"
            leftIcon={<Mail className="h-4 w-4" />}
          />

          <div className="space-y-1.5">
            <label className="text-text-secondary text-sm font-medium">
              Peran
            </label>
            <StyledSelect
              value={inviteForm.role}
              onChange={(v) =>
                setInviteForm((f) => ({
                  ...f,
                  role: v as Exclude<UserRole, "owner">,
                }))
              }
              options={[
                {
                  value: "member",
                  label: "Anggota — dapat mencatat transaksi",
                },
                { value: "viewer", label: "Penonton — hanya bisa melihat" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <label className="text-text-secondary text-sm font-medium">
              Izin Akses
            </label>
            <div className="border-border bg-bg-elevated space-y-2 rounded-lg border p-3">
              {(
                [
                  {
                    key: "canViewAllWallets",
                    label: "Lihat semua dompet",
                    icon: "👁",
                  },
                  {
                    key: "canAddTransactions",
                    label: "Tambah transaksi",
                    icon: "➕",
                  },
                  {
                    key: "canManageBudgets",
                    label: "Kelola anggaran",
                    icon: "📊",
                  },
                ] as const
              ).map((perm) => (
                <label
                  key={perm.key}
                  className="flex cursor-pointer items-center gap-3"
                >
                  <input
                    type="checkbox"
                    checked={inviteForm[perm.key]}
                    onChange={(e) =>
                      setInviteForm((f) => ({
                        ...f,
                        [perm.key]: e.target.checked,
                      }))
                    }
                    className="border-border accent-primary h-4 w-4 rounded"
                  />
                  <span className="text-text-primary text-sm">
                    {perm.icon} {perm.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {!inviteForm.canViewAllWallets && (
            <div className="space-y-2">
              <label className="text-text-secondary text-sm font-medium">
                Akses Dompet Spesifik
              </label>
              <div className="border-border bg-bg-elevated max-h-40 space-y-1.5 overflow-y-auto rounded-lg border p-3">
                {allWallets.map((w) => (
                  <label
                    key={w.id}
                    className="flex cursor-pointer items-center gap-3"
                  >
                    <input
                      type="checkbox"
                      checked={inviteForm.walletIds.includes(w.id)}
                      onChange={() => toggleWalletId(w.id)}
                      className="border-border accent-primary h-4 w-4 rounded"
                    />
                    <span className="text-text-primary text-sm">
                      {w.icon} {w.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowInviteModal(false);
                setInviteForm(EMPTY_INVITE);
              }}
            >
              Batal
            </Button>
            <Button
              className="flex-1"
              loading={inviting}
              disabled={!inviteForm.email}
              leftIcon={!inviting ? <Send className="h-4 w-4" /> : undefined}
              onClick={handleInvite}
            >
              Kirim Undangan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Tab 3: Notifikasi ────────────────────────────────────────────────────────

interface ChannelState {
  whatsapp: { enabled: boolean; phone: string };
  telegram: { enabled: boolean; chatId: string; botToken: string };
  email: { enabled: boolean; address: string };
  push: { enabled: boolean };
}

type PrefState = NotificationSettings["preferences"];

function NotifikasiTab() {
  const { notificationSettings, updateNotificationSettings } =
    useFinanceStore();

  const [channels, setChannels] = useState<ChannelState>({
    ...notificationSettings.channels,
  });
  const [prefs, setPrefs] = useState<PrefState>({
    ...notificationSettings.preferences,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaving(true);
    setTimeout(() => {
      updateNotificationSettings({ channels, preferences: prefs });
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }, 700);
  }

  const CHANNEL_CONFIG = [
    {
      key: "whatsapp" as const,
      label: "WhatsApp",
      icon: "💬",
      color: "text-green-400 bg-green-500/15",
      extraField: (
        <Input
          placeholder="+62 812 xxxx xxxx"
          value={channels.whatsapp.phone}
          onChange={(e) =>
            setChannels((c) => ({
              ...c,
              whatsapp: { ...c.whatsapp, phone: e.target.value },
            }))
          }
          leftIcon={<Phone className="h-4 w-4" />}
        />
      ),
    },
    {
      key: "telegram" as const,
      label: "Telegram",
      icon: "✈️",
      color: "text-sky-400 bg-sky-500/15",
      extraField: (
        <Input
          placeholder="Chat ID Telegram"
          value={channels.telegram.chatId}
          onChange={(e) =>
            setChannels((c) => ({
              ...c,
              telegram: { ...c.telegram, chatId: e.target.value },
            }))
          }
          leftIcon={<MessageSquare className="h-4 w-4" />}
        />
      ),
    },
    {
      key: "email" as const,
      label: "Email",
      icon: "📧",
      color: "text-blue-400 bg-blue-500/15",
      extraField: (
        <Input
          type="email"
          placeholder="email@contoh.com"
          value={channels.email.address}
          onChange={(e) =>
            setChannels((c) => ({
              ...c,
              email: { ...c.email, address: e.target.value },
            }))
          }
          leftIcon={<Mail className="h-4 w-4" />}
        />
      ),
    },
    {
      key: "push" as const,
      label: "Push Notification",
      icon: "🔔",
      color: "text-purple-400 bg-purple-500/15",
      extraField: null,
    },
  ];

  const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  return (
    <div className="space-y-5">
      {/* Channel Cards */}
      <Card>
        <CardHeader>
          <p className="text-text-primary font-semibold">Saluran Notifikasi</p>
        </CardHeader>
        <CardBody className="space-y-4">
          {CHANNEL_CONFIG.map((ch) => {
            const isEnabled =
              ch.key === "push"
                ? channels.push.enabled
                : ch.key === "whatsapp"
                  ? channels.whatsapp.enabled
                  : ch.key === "telegram"
                    ? channels.telegram.enabled
                    : channels.email.enabled;

            function toggleChannel(v: boolean) {
              if (ch.key === "push") {
                setChannels((c) => ({ ...c, push: { enabled: v } }));
              } else {
                setChannels((c) => ({
                  ...c,
                  [ch.key]: { ...(c[ch.key] as object), enabled: v },
                }));
              }
            }

            return (
              <div
                key={ch.key}
                className="border-border bg-bg-elevated space-y-3 rounded-xl border p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg",
                        ch.color,
                      )}
                    >
                      {ch.icon}
                    </div>
                    <div>
                      <p className="text-text-primary text-sm font-medium">
                        {ch.label}
                      </p>
                      <p className="text-text-muted text-xs">
                        {isEnabled ? "Aktif" : "Nonaktif"}
                      </p>
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={isEnabled}
                    onCheckedChange={toggleChannel}
                  />
                </div>
                <AnimatePresence>
                  {isEnabled && ch.extraField && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      {ch.extraField}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </CardBody>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <p className="text-text-primary font-semibold">Preferensi</p>
        </CardHeader>
        <CardBody className="divide-border divide-y">
          {/* Daily reminder */}
          <div className="py-4 first:pt-0 last:pb-0">
            <PrefRow
              label="Pengingat Harian"
              description="Ingatkan untuk mencatat transaksi hari ini"
              checked={prefs.dailyReminder}
              onCheckedChange={(v) =>
                setPrefs((p) => ({ ...p, dailyReminder: v }))
              }
            >
              <Input
                type="time"
                value={prefs.dailyReminderTime}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    dailyReminderTime: e.target.value,
                  }))
                }
                className="w-36"
              />
            </PrefRow>
          </div>

          {/* Weekly report */}
          <div className="py-4">
            <PrefRow
              label="Laporan Mingguan"
              description="Ringkasan keuangan setiap minggu"
              checked={prefs.weeklyReport}
              onCheckedChange={(v) =>
                setPrefs((p) => ({ ...p, weeklyReport: v }))
              }
            >
              <StyledSelect
                value={String(prefs.weeklyReportDay)}
                onChange={(v) =>
                  setPrefs((p) => ({ ...p, weeklyReportDay: Number(v) }))
                }
                options={DAYS.map((d, i) => ({ value: String(i), label: d }))}
              />
            </PrefRow>
          </div>

          {/* Monthly report */}
          <div className="py-4">
            <PrefRow
              label="Laporan Bulanan"
              description="Ringkasan keuangan setiap bulan"
              checked={prefs.monthlyReport}
              onCheckedChange={(v) =>
                setPrefs((p) => ({ ...p, monthlyReport: v }))
              }
            />
          </div>

          {/* Budget alert */}
          <div className="py-4">
            <PrefRow
              label="Alert Anggaran"
              description="Notifikasi saat mendekati batas anggaran"
              checked={prefs.budgetAlert}
              onCheckedChange={(v) =>
                setPrefs((p) => ({ ...p, budgetAlert: v }))
              }
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-xs">
                    Threshold: {prefs.budgetAlertThreshold}%
                  </span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={95}
                  step={5}
                  value={prefs.budgetAlertThreshold}
                  onChange={(e) =>
                    setPrefs((p) => ({
                      ...p,
                      budgetAlertThreshold: Number(e.target.value),
                    }))
                  }
                  className="accent-primary w-full"
                />
                <div className="text-text-muted flex justify-between text-[10px]">
                  <span>50%</span>
                  <span>95%</span>
                </div>
              </div>
            </PrefRow>
          </div>

          {/* Bill reminder */}
          <div className="py-4">
            <PrefRow
              label="Pengingat Tagihan"
              description="Ingatkan sebelum tanggal jatuh tempo"
              checked={prefs.billReminder}
              onCheckedChange={(v) =>
                setPrefs((p) => ({ ...p, billReminder: v }))
              }
            >
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={14}
                  value={String(prefs.billReminderDays)}
                  onChange={(e) =>
                    setPrefs((p) => ({
                      ...p,
                      billReminderDays: Number(e.target.value),
                    }))
                  }
                  className="w-20"
                />
                <span className="text-text-muted text-sm">hari sebelumnya</span>
              </div>
            </PrefRow>
          </div>

          {/* Saving goal update */}
          <div className="py-4">
            <PrefRow
              label="Update Tabungan"
              description="Notifikasi progres target tabungan"
              checked={prefs.savingGoalUpdate}
              onCheckedChange={(v) =>
                setPrefs((p) => ({ ...p, savingGoalUpdate: v }))
              }
            />
          </div>

          {/* Debt reminder */}
          <div className="py-4">
            <PrefRow
              label="Pengingat Hutang"
              description="Ingatkan hutang & piutang yang belum lunas"
              checked={prefs.debtReminder}
              onCheckedChange={(v) =>
                setPrefs((p) => ({ ...p, debtReminder: v }))
              }
            />
          </div>

          {/* Large transaction */}
          <div className="py-4 last:pb-0">
            <PrefRow
              label="Alert Transaksi Besar"
              description="Notifikasi untuk transaksi di atas batas"
              checked={prefs.largeTransactionAlert}
              onCheckedChange={(v) =>
                setPrefs((p) => ({ ...p, largeTransactionAlert: v }))
              }
            >
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-sm">Rp</span>
                <Input
                  type="number"
                  min={0}
                  step={100000}
                  value={String(prefs.largeTransactionThreshold)}
                  onChange={(e) =>
                    setPrefs((p) => ({
                      ...p,
                      largeTransactionThreshold: Number(e.target.value),
                    }))
                  }
                  placeholder="500000"
                />
              </div>
            </PrefRow>
          </div>
        </CardBody>
      </Card>

      {/* Save bar */}
      <div className="flex items-center justify-between">
        <AnimatePresence>
          {saved && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="text-success flex items-center gap-1.5 text-sm"
            >
              <Check className="h-4 w-4" />
              Pengaturan disimpan
            </motion.div>
          )}
        </AnimatePresence>
        <div className="ml-auto">
          <Button loading={saving} onClick={handleSave}>
            Simpan Pengaturan
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 4: Keamanan ──────────────────────────────────────────────────────────

function KeamananTab() {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    newPass: "",
    confirm: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [sessions, setSessions] = useState(MOCK_SESSIONS);

  function handleChangePassword() {
    if (!passwordForm.current || !passwordForm.newPass) return;
    setSavingPassword(true);
    setTimeout(() => {
      setSavingPassword(false);
      setPasswordSaved(true);
      setPasswordForm({ current: "", newPass: "", confirm: "" });
      setTimeout(() => setPasswordSaved(false), 2500);
    }, 800);
  }

  function revokeSession(id: string) {
    setSessions((s) => s.filter((s) => s.id !== id));
  }

  const passwordMismatch =
    passwordForm.confirm.length > 0 &&
    passwordForm.newPass !== passwordForm.confirm;

  return (
    <div className="space-y-5">
      {/* Change Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="text-text-muted h-4 w-4" />
            <p className="text-text-primary font-semibold">Ubah Password</p>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="relative">
            <Input
              label="Password Saat Ini"
              type={showCurrent ? "text" : "password"}
              value={passwordForm.current}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, current: e.target.value }))
              }
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="text-text-muted hover:text-text-secondary absolute top-8 right-3"
            >
              {showCurrent ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="relative">
            <Input
              label="Password Baru"
              type={showNew ? "text" : "password"}
              value={passwordForm.newPass}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, newPass: e.target.value }))
              }
              placeholder="Min. 8 karakter"
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="text-text-muted hover:text-text-secondary absolute top-8 right-3"
            >
              {showNew ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="relative">
            <Input
              label="Konfirmasi Password"
              type={showConfirm ? "text" : "password"}
              value={passwordForm.confirm}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, confirm: e.target.value }))
              }
              placeholder="Ulangi password baru"
              error={passwordMismatch ? "Password tidak cocok" : undefined}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="text-text-muted hover:text-text-secondary absolute top-8 right-3"
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Button
              loading={savingPassword}
              disabled={
                !passwordForm.current ||
                !passwordForm.newPass ||
                passwordMismatch
              }
              onClick={handleChangePassword}
              leftIcon={
                !savingPassword ? <Key className="h-4 w-4" /> : undefined
              }
            >
              Ubah Password
            </Button>
            <AnimatePresence>
              {passwordSaved && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-success flex items-center gap-1 text-sm"
                >
                  <Check className="h-4 w-4" />
                  Password diubah
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </CardBody>
      </Card>

      {/* 2FA */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="text-text-muted h-4 w-4" />
            <p className="text-text-primary font-semibold">
              Two-Factor Authentication
            </p>
          </div>
          <ToggleSwitch
            checked={twoFAEnabled}
            onCheckedChange={setTwoFAEnabled}
          />
        </CardHeader>
        <CardBody>
          {!twoFAEnabled ? (
            <p className="text-text-secondary text-sm">
              2FA saat ini{" "}
              <span className="text-warning font-medium">nonaktif</span>.
              Aktifkan untuk keamanan ekstra dengan aplikasi autentikator.
            </p>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-xl bg-white p-2">
                  <div className="grid h-full w-full grid-cols-5 gap-0.5">
                    {QR_PATTERN.map((dark, i) => (
                      <div
                        key={i}
                        className={cn(
                          "rounded-[1px]",
                          dark ? "bg-black" : "bg-white",
                        )}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-text-primary text-sm font-medium">
                    Scan QR Code
                  </p>
                  <p className="text-text-muted text-xs leading-relaxed">
                    Buka aplikasi Google Authenticator atau Authy, lalu scan QR
                    code ini.
                  </p>
                  <div className="bg-bg-elevated flex items-center gap-1.5 rounded-lg px-3 py-2">
                    <QrCode className="text-text-muted h-3.5 w-3.5" />
                    <code className="text-text-secondary text-xs">
                      JBSWY3DPEHPK3PXP
                    </code>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-text-primary mb-2 text-sm font-medium">
                  Kode Cadangan
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {BACKUP_CODES.map((code) => (
                    <div
                      key={code}
                      className="border-border bg-bg-elevated text-text-secondary rounded-lg border px-3 py-1.5 text-center font-mono text-sm"
                    >
                      {code}
                    </div>
                  ))}
                </div>
                <p className="text-text-muted mt-2 text-xs">
                  Simpan kode ini di tempat aman. Masing-masing hanya bisa
                  digunakan sekali.
                </p>
              </div>
            </motion.div>
          )}
        </CardBody>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Monitor className="text-text-muted h-4 w-4" />
            <p className="text-text-primary font-semibold">Sesi Aktif</p>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="bg-bg-elevated flex items-center justify-between gap-3 rounded-lg p-3"
            >
              <div className="flex items-center gap-3">
                {s.icon === "desktop" ? (
                  <Monitor className="text-text-muted h-5 w-5 shrink-0" />
                ) : (
                  <Smartphone className="text-text-muted h-5 w-5 shrink-0" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-text-primary text-sm font-medium">
                      {s.device}
                    </p>
                    {s.current && (
                      <Badge variant="success" size="sm">
                        Ini
                      </Badge>
                    )}
                  </div>
                  <p className="text-text-muted text-xs">
                    {s.location} · {s.lastActive}
                  </p>
                </div>
              </div>
              {!s.current && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:bg-danger/10 hover:text-danger shrink-0"
                  onClick={() => revokeSession(s.id)}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </CardBody>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <p className="text-text-primary font-semibold">Log Aktivitas</p>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border border-b">
                  <th className="text-text-muted pb-2.5 text-left text-xs font-medium">
                    Tanggal
                  </th>
                  <th className="text-text-muted pb-2.5 text-left text-xs font-medium">
                    Perangkat
                  </th>
                  <th className="text-text-muted pb-2.5 text-left text-xs font-medium">
                    IP Address
                  </th>
                  <th className="text-text-muted pb-2.5 text-left text-xs font-medium">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {MOCK_ACTIVITY.map((log) => (
                  <tr key={log.id}>
                    <td className="text-text-secondary py-2.5 text-xs">
                      {log.date}
                    </td>
                    <td className="text-text-secondary py-2.5 text-xs">
                      {log.device}
                    </td>
                    <td className="text-text-muted py-2.5 font-mono text-xs">
                      {log.ip}
                    </td>
                    <td className="py-2.5">
                      <Badge
                        variant={log.action === "Login" ? "success" : "warning"}
                        size="sm"
                      >
                        {log.action}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ─── Tab 5: Data & Ekspor ─────────────────────────────────────────────────────

type ExportKey = "pdf" | "csv" | "json";

function DataEksporTab() {
  const [exporting, setExporting] = useState<Record<ExportKey, boolean>>({
    pdf: false,
    csv: false,
    json: false,
  });
  const [selectedMonth, setSelectedMonth] = useState("2026-06");
  const [isDragging, setIsDragging] = useState(false);
  const [importedFile, setImportedFile] = useState<string | null>(null);

  function handleExport(key: ExportKey) {
    setExporting((e) => ({ ...e, [key]: true }));
    setTimeout(() => {
      setExporting((e) => ({ ...e, [key]: false }));
    }, 1500);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setImportedFile(file.name);
  }

  const EXPORT_CARDS = [
    {
      key: "pdf" as ExportKey,
      icon: <FileText className="h-6 w-6" />,
      title: "Laporan Bulanan PDF",
      description:
        "Laporan lengkap termasuk transaksi, anggaran, dan ringkasan",
      color: "text-red-400 bg-red-500/15",
      action: "Unduh PDF",
      extra: null,
    },
    {
      key: "csv" as ExportKey,
      icon: <FileSpreadsheet className="h-6 w-6" />,
      title: "Data Excel / CSV",
      description: "Export semua transaksi dalam format spreadsheet",
      color: "text-green-400 bg-green-500/15",
      action: "Unduh CSV",
      extra: (
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className={cn(
            "border-border bg-bg-surface text-text-primary h-9 rounded-lg border px-3 text-sm",
            "focus:ring-primary/50 focus:ring-2 focus:outline-none",
          )}
        />
      ),
    },
    {
      key: "json" as ExportKey,
      icon: <FileJson className="h-6 w-6" />,
      title: "Backup Lengkap JSON",
      description: "Backup seluruh data keuangan kamu",
      color: "text-yellow-400 bg-yellow-500/15",
      action: "Unduh Backup",
      extra: null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Export */}
      <div>
        <SectionTitle>Ekspor Data</SectionTitle>
        <div className="space-y-3">
          {EXPORT_CARDS.map((card) => (
            <Card key={card.key}>
              <CardBody>
                <div className="flex flex-wrap items-center gap-4">
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                      card.color,
                    )}
                  >
                    {card.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-text-primary font-medium">
                      {card.title}
                    </p>
                    <p className="text-text-muted text-sm">
                      {card.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {card.extra}
                    <Button
                      variant="outline"
                      size="sm"
                      loading={exporting[card.key]}
                      leftIcon={
                        !exporting[card.key] ? (
                          <Download className="h-4 w-4" />
                        ) : undefined
                      }
                      onClick={() => handleExport(card.key)}
                    >
                      {exporting[card.key] ? "Memproses..." : card.action}
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {/* Import */}
      <div>
        <SectionTitle>Impor Data</SectionTitle>
        <Card>
          <CardBody className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-border/80",
              )}
            >
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl",
                  isDragging
                    ? "bg-primary/20 text-primary"
                    : "bg-bg-elevated text-text-muted",
                )}
              >
                <Upload className="h-6 w-6" />
              </div>
              <div className="text-center">
                <p className="text-text-primary text-sm font-medium">
                  {isDragging
                    ? "Lepas file di sini"
                    : "Seret & lepas file di sini"}
                </p>
                <p className="text-text-muted mt-0.5 text-xs">
                  Format didukung: CSV, XLS, XLSX
                </p>
              </div>
              <label>
                <input
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setImportedFile(file.name);
                  }}
                />
                <span className="border-border bg-bg-elevated text-text-primary hover:bg-bg-surface inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors">
                  <Upload className="h-4 w-4" />
                  Pilih File
                </span>
              </label>
            </div>

            {importedFile && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-success/20 bg-success/10 flex items-center justify-between rounded-lg border px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <Check className="text-success h-4 w-4" />
                  <span className="text-success text-sm">{importedFile}</span>
                </div>
                <button
                  onClick={() => setImportedFile(null)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}

            <p className="text-text-muted text-xs">
              Format template dapat diunduh{" "}
              <span className="text-primary cursor-pointer underline underline-offset-2">
                di sini
              </span>
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Danger zone */}
      <div>
        <SectionTitle>Hapus Data</SectionTitle>
        <Card className="border-danger/20">
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-text-primary text-sm font-medium">
                  Reset Semua Transaksi
                </p>
                <p className="text-text-muted text-xs">
                  Hapus seluruh riwayat transaksi (dompet tetap)
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  const ok = await confirm({
                    title: "Reset semua transaksi?",
                    message: "Tindakan ini tidak bisa dibatalkan.",
                    variant: "warning",
                    confirmText: "Reset",
                  });
                  if (ok) {
                    // UI only — no real action
                  }
                }}
              >
                Reset Transaksi
              </Button>
            </div>

            <div className="border-border/50 border-t pt-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-text-primary text-sm font-medium">
                    Reset Semua Data
                  </p>
                  <p className="text-text-muted text-xs">
                    Hapus seluruh data akun dan mulai dari awal
                  </p>
                </div>
                <Button
                  size="sm"
                  className="bg-red-950 text-red-200 hover:bg-red-900"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Reset SEMUA data?",
                      message:
                        "Ini akan menghapus dompet, transaksi, anggaran, dan semua data lainnya. Tindakan ini TIDAK BISA dibatalkan.",
                      variant: "danger",
                      confirmText: "Reset Semua",
                    });
                    if (ok) {
                      // UI only — no real action
                    }
                  }}
                >
                  Reset Semua Data
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// ─── QRIS Tab ───────────────────────────────────────────────────────────────

function QrisTab() {
  const { config, updateConfig } = useAppConfigStore();
  const [qris, setQris] = useState(config.qrisStatic ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync local state when config changes externally
  useEffect(() => {
    setQris(config.qrisStatic ?? "");
  }, [config.qrisStatic]);

  const isValid = !qris || isValidQrisShapeLocal(qris);

  /**
   * Push the current value to the backend AppSetting table.
   * Returns true on success.
   */
  async function persistToBackend(value: string): Promise<boolean> {
    try {
      // Read the auth token the same way `useFinanceStore.getBackendToken`
      // does — it lives at localStorage["fintrack_auth"].state.token, not
      // at a top-level "fintrack_token" key (the previous implementation
      // used the wrong key, so the PUT silently failed with 401 and the
      // DB never got the QRIS — which is exactly why the public pay
      // page kept showing "QRIS belum tersedia").
      let token: string | null = null;
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem("fintrack_auth");
          const parsed = raw
            ? (JSON.parse(raw) as { state?: { token?: unknown } })
            : null;
          const t = parsed?.state?.token;
          if (t && t !== "dev-fallback-token") token = String(t);
        } catch {
          /* corrupt storage entry — fall through */
        }
      }
      if (!token) return true; // dev fallback — local-only is fine
      const r = await fetch(`${getApiBaseUrl()}/app-config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ qrisStatic: value }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setSaveError(
        `QR tersimpan di sesi ini, tapi gagal sinkron ke server: ${msg}`,
      );
      return false;
    }
  }

  async function handleSave() {
    setSaveError(null);
    setSaving(true);
    // Optimistic local update so the QrisModal works immediately.
    updateConfig({ qrisStatic: qris });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    const ok = await persistToBackend(qris);
    void ok;
    setSaving(false);
  }

  // Debounced auto-save: whenever the local value changes (image upload,
  // paste, or manual edit), push it to the backend after a short delay.
  // The DB is the source of truth for the public pay page, so we MUST
  // keep it in sync — relying on a manual "Simpan" click caused the
  // public link to show "QRIS belum tersedia" even though the merchant's
  // own session could render the QR.
  useEffect(() => {
    if (!qris) return; // empty = nothing to persist
    if (!isValid) return; // don't save invalid payloads
    if (qris === config.qrisStatic) return; // no change
    const timer = window.setTimeout(() => {
      void (async () => {
        // Re-check at fire time: another save may have already pushed
        // the same value (e.g. the user clicked "Simpan" while the
        // debounce was still pending).
        if (qris === useAppConfigStore.getState().config.qrisStatic) return;
        setSaving(true);
        // Apply optimistically so the in-app QrisModal picks it up
        // immediately, even if the network call is still in flight.
        updateConfig({ qrisStatic: qris });
        await persistToBackend(qris);
        setSaving(false);
      })();
    }, 500);
    return () => window.clearTimeout(timer);
    // We intentionally do NOT include updateConfig / persistToBackend
    // here — they are stable references and we only want to react to
    // value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qris, isValid]);

  // Mount-time save: if the QR was set in a previous session and is
  // sitting in localStorage but never reached the DB (e.g. the user
  // uploaded via QrisImageUpload and never clicked "Simpan" before my
  // fix was deployed), push it now so the public pay page can render
  // it. This is idempotent — if the DB already has the same value, the
  // PUT is a no-op.
  useEffect(() => {
    if (!qris || !isValid) return;
    // Fire as soon as the network is idle / microtask finishes, so we
    // don't block the first paint but the DB is updated well before
    // the user could open a share link.
    queueMicrotask(() => {
      void (async () => {
        setSaving(true);
        await persistToBackend(qris);
        setSaving(false);
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty deps = run once on mount

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <QrCode className="text-text-muted h-4 w-4" />
            <p className="text-text-primary font-semibold">QRIS Statis</p>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-text-muted text-sm">
            Paste string QRIS statis dari e-wallet kamu (GoPay, OVO, DANA,
            ShopeePay, dll), atau cukup upload screenshot QR-nya — string akan
            otomatis ke-ekstrak. String ini akan dipakai untuk men-generate QRIS
            dinamis sesuai nominal tagihan saat kamu menagih peserta split bill.
          </p>

          <QrisImageUpload
            onDecoded={(payload) => {
              setQris(payload);
              setSaved(false);
            }}
          />

          <div className="border-border flex items-center gap-3">
            <div className="bg-border h-px flex-1" />
            <span className="text-text-muted text-[10px] font-medium tracking-wider uppercase">
              atau paste manual
            </span>
            <div className="bg-border h-px flex-1" />
          </div>

          <div className="space-y-2">
            <label className="text-text-secondary text-sm font-medium">
              String QRIS
            </label>
            <textarea
              value={qris}
              onChange={(e) => setQris(e.target.value)}
              placeholder="00020101021126... (string panjang dari e-wallet kamu)"
              rows={4}
              className="border-border bg-bg-surface text-text-primary placeholder:text-text-muted focus:ring-primary/50 w-full rounded-lg border px-3 py-2 font-mono text-xs focus:ring-2 focus:outline-none"
            />
            {qris && !isValid && (
              <p className="text-danger text-xs">
                Format tidak valid. QRIS harus diawali "00" dan diakhiri "63".
              </p>
            )}
            {qris && isValid && (
              <p className="text-success text-xs">
                ✓ Format valid ({qris.length} karakter)
              </p>
            )}
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-text-muted">
                Server:{" "}
                {config.qrisStatic
                  ? `${config.qrisStatic.length} karakter`
                  : "kosong"}
              </span>
              {config.qrisStatic && qris === config.qrisStatic && (
                <span className="text-success">✓ tersinkron</span>
              )}
              {config.qrisStatic && qris !== config.qrisStatic && qris && (
                <span className="text-warning">↻ menyinkronkan…</span>
              )}
            </div>
          </div>
          <details className="border-border rounded-lg border p-3">
            <summary className="text-text-muted cursor-pointer text-xs font-medium">
              Cara mendapatkan string QRIS
            </summary>
            <ol className="text-text-muted mt-2 list-decimal space-y-1 pl-5 text-xs">
              <li>
                <strong>Cara cepat:</strong> screenshot QRIS dari e-wallet, lalu
                upload di atas — string otomatis ke-ekstrak.
              </li>
              <li>
                <strong>Cara manual:</strong> buka e-wallet (GoPay/OVO/DANA/dll)
                → pilih menu QRIS / Tampilkan QR.
              </li>
              <li>
                Biasanya ada tombol "Salin" atau "Share" — pilih opsi "Salin
                Teks" / "Copy String".
              </li>
              <li>Paste di kolom "String QRIS" di atas.</li>
            </ol>
          </details>
          <div className="border-border flex items-center justify-between gap-3 border-t pt-3">
            <AnimatePresence mode="wait">
              {saveError ? (
                <motion.div
                  key="err"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-danger flex items-start gap-1.5 text-xs"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{saveError}</span>
                </motion.div>
              ) : saving ? (
                <motion.div
                  key="saving"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-text-muted flex items-center gap-1.5 text-xs"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Menyinkronkan ke server…
                </motion.div>
              ) : saved ? (
                <motion.div
                  key="ok"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-success flex items-center gap-1.5 text-sm"
                >
                  <Check className="h-4 w-4" />
                  QRIS disimpan
                </motion.div>
              ) : null}
            </AnimatePresence>
            <div className="ml-auto flex gap-2">
              {qris && (
                <Button variant="ghost" size="sm" onClick={() => setQris("")}>
                  Hapus
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!isValid}
                leftIcon={<Check className="h-4 w-4" />}
              >
                Simpan
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="border-warning/30 bg-warning/5">
        <div className="flex gap-3">
          <Shield className="text-warning h-5 w-5 shrink-0" />
          <div className="text-xs">
            <p className="text-text-primary font-semibold">Catatan Keamanan</p>
            <p className="text-text-muted mt-1">
              String QRIS disimpan lokal di browser dan disinkronkan ke database{" "}
              {config.appName}. Jangan share string ini ke publik karena siapa
              pun yang punya string bisa menerima pembayaran atas nama kamu.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function isValidQrisShapeLocal(input: string): boolean {
  if (!input || input.length < 20) return false;
  if (!input.startsWith("00")) return false;
  if (!input.slice(-8).startsWith("63")) return false;
  return true;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profil");

  return (
    <PageWrapper
      title="Pengaturan"
      subtitle="Kelola profil, tim, dan preferensi akun"
    >
      <Tabs.Root
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        {/* Tab list */}
        <div className="overflow-x-auto">
          <Tabs.List className="border-border bg-bg-elevated flex min-w-max gap-1 rounded-xl border p-1">
            {TAB_ITEMS.map((t) => {
              const Icon = t.icon;
              return (
                <Tabs.Trigger
                  key={t.value}
                  value={t.value}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
                    "transition-all duration-150",
                    "text-text-muted hover:text-text-secondary",
                    "focus-visible:ring-primary/50 focus:outline-none focus-visible:ring-2",
                    "data-[state=active]:bg-bg-surface data-[state=active]:text-text-primary data-[state=active]:shadow-sm",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {t.label}
                </Tabs.Trigger>
              );
            })}
          </Tabs.List>
        </div>

        {/* Tab contents */}
        <Tabs.Content value="profil" className="focus:outline-none">
          <ProfilTab />
        </Tabs.Content>

        <Tabs.Content value="qris" className="focus:outline-none">
          <QrisTab />
        </Tabs.Content>

        <Tabs.Content value="tim" className="focus:outline-none">
          <AnggotaTimTab />
        </Tabs.Content>

        <Tabs.Content value="notifikasi" className="focus:outline-none">
          <NotifikasiTab />
        </Tabs.Content>

        <Tabs.Content value="keamanan" className="focus:outline-none">
          <KeamananTab />
        </Tabs.Content>

        <Tabs.Content value="data" className="focus:outline-none">
          <DataEksporTab />
        </Tabs.Content>
      </Tabs.Root>
    </PageWrapper>
  );
}
