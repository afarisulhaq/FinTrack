"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Ban,
  CheckCircle2,
  Eye,
  Users,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Modal } from "~/components/ui/modal";
import { Badge } from "~/components/ui/badge";
import { confirm } from "~/components/ui/confirm-dialog";

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "owner" | "member";
  status: "active" | "inactive";
  joinedAt: string;
  transactions: number;
  wallets: number;
}

const initialUsers: ManagedUser[] = [
  {
    id: "1",
    name: "Admin FinTrack",
    email: "admin@fintrack.app",
    role: "admin",
    status: "active",
    joinedAt: "01 Jan 2026",
    transactions: 0,
    wallets: 0,
  },
  {
    id: "2",
    name: "Andi Pratama",
    email: "demo@fintrack.app",
    role: "owner",
    status: "active",
    joinedAt: "08 Jan 2026",
    transactions: 184,
    wallets: 5,
  },
  {
    id: "3",
    name: "Sari Dewi",
    email: "sari@email.com",
    role: "member",
    status: "active",
    joinedAt: "14 Jan 2026",
    transactions: 67,
    wallets: 2,
  },
  {
    id: "4",
    name: "Budi Santoso",
    email: "budi@email.com",
    role: "owner",
    status: "active",
    joinedAt: "22 Jan 2026",
    transactions: 223,
    wallets: 8,
  },
  {
    id: "5",
    name: "Rina Maharani",
    email: "rina@email.com",
    role: "owner",
    status: "active",
    joinedAt: "05 Feb 2026",
    transactions: 91,
    wallets: 4,
  },
  {
    id: "6",
    name: "Fajar Nugroho",
    email: "fajar@email.com",
    role: "member",
    status: "inactive",
    joinedAt: "15 Feb 2026",
    transactions: 28,
    wallets: 1,
  },
  {
    id: "7",
    name: "Dewi Anggraini",
    email: "dewi@email.com",
    role: "owner",
    status: "active",
    joinedAt: "01 Mar 2026",
    transactions: 144,
    wallets: 6,
  },
  {
    id: "8",
    name: "Agus Saputra",
    email: "agus@email.com",
    role: "member",
    status: "inactive",
    joinedAt: "17 Mar 2026",
    transactions: 13,
    wallets: 1,
  },
  {
    id: "9",
    name: "Maya Lestari",
    email: "maya@email.com",
    role: "owner",
    status: "active",
    joinedAt: "10 Apr 2026",
    transactions: 72,
    wallets: 3,
  },
  {
    id: "10",
    name: "Rizky Ramadhan",
    email: "rizky@email.com",
    role: "member",
    status: "active",
    joinedAt: "29 Apr 2026",
    transactions: 41,
    wallets: 2,
  },
  {
    id: "11",
    name: "Nadia Putri",
    email: "nadia@email.com",
    role: "owner",
    status: "active",
    joinedAt: "12 Mei 2026",
    transactions: 53,
    wallets: 3,
  },
];

const emptyForm = {
  name: "",
  email: "",
  role: "owner" as ManagedUser["role"],
  status: "active" as ManagedUser["status"],
  password: "",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<ManagedUser | null>(null);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(
    () =>
      users.filter((user) => {
        const matchesSearch = `${user.name} ${user.email}`
          .toLowerCase()
          .includes(search.toLowerCase());
        return (
          matchesSearch &&
          (role === "all" || user.role === role) &&
          (status === "all" || user.status === status)
        );
      }),
    [role, search, status, users],
  );

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }
  function openEdit(user: ManagedUser) {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      password: "",
    });
    setModalOpen(true);
  }
  function saveUser(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    if (editing)
      setUsers((list) =>
        list.map((user) =>
          user.id === editing.id
            ? {
                ...user,
                name: form.name,
                email: form.email,
                role: form.role,
                status: form.status,
              }
            : user,
        ),
      );
    else
      setUsers((list) => [
        {
          id: String(Date.now()),
          name: form.name,
          email: form.email,
          role: form.role,
          status: form.status,
          joinedAt: new Date().toLocaleDateString("id-ID"),
          transactions: 0,
          wallets: 0,
        },
        ...list,
      ]);
    setModalOpen(false);
  }
  async function removeUser(id: string) {
    const ok = await confirm({
      title: "Hapus pengguna ini?",
      message: "Tindakan ini tidak bisa dibatalkan.",
      variant: "danger",
    });
    if (ok) setUsers((list) => list.filter((user) => user.id !== id));
  }
  function toggleStatus(id: string) {
    setUsers((list) =>
      list.map((user) =>
        user.id === id
          ? {
              ...user,
              status: user.status === "active" ? "inactive" : "active",
            }
          : user,
      ),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold">Manajemen Pengguna</h2>
          <p className="text-text-muted text-sm">
            Kelola akun, akses, role, dan status pengguna.
          </p>
        </div>
        <Button onClick={openAdd} leftIcon={<Plus className="h-4 w-4" />}>
          Tambah Pengguna
        </Button>
      </div>
      <div className="border-border bg-bg-surface flex flex-col gap-3 rounded-xl border p-4 lg:flex-row">
        <div className="flex-1">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama atau email..."
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <select
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="bg-bg-elevated border-border h-10 rounded-lg border px-3 text-sm"
        >
          <option value="all">Semua Role</option>
          <option value="admin">Admin</option>
          <option value="owner">Owner</option>
          <option value="member">Member</option>
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="bg-bg-elevated border-border h-10 rounded-lg border px-3 text-sm"
        >
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
      </div>
      <div className="border-border bg-bg-surface overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-text-muted border-border bg-bg-elevated/40 border-b text-left">
                <th className="p-4">Pengguna</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Bergabung</th>
                <th className="pr-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr
                  key={user.id}
                  className="border-border/60 hover:bg-bg-elevated/30 border-b"
                >
                  <td className="p-4">
                    <button
                      onClick={() => setDetail(user)}
                      className="flex items-center gap-3 text-left"
                    >
                      <span className="bg-warning/15 text-warning flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold">
                        {initials(user.name)}
                      </span>
                      <span className="font-semibold">{user.name}</span>
                    </button>
                  </td>
                  <td className="text-text-muted">{user.email}</td>
                  <td>
                    <Badge
                      variant={
                        user.role === "admin"
                          ? "danger"
                          : user.role === "owner"
                            ? "purple"
                            : "success"
                      }
                    >
                      {user.role}
                    </Badge>
                  </td>
                  <td>
                    <Badge
                      variant={user.status === "active" ? "success" : "default"}
                    >
                      {user.status === "active" ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="text-text-muted">{user.joinedAt}</td>
                  <td>
                    <div className="flex justify-end gap-1 pr-3">
                      <button
                        onClick={() => setDetail(user)}
                        className="hover:bg-bg-elevated text-text-muted rounded-lg p-2"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEdit(user)}
                        className="hover:bg-bg-elevated text-text-muted rounded-lg p-2"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleStatus(user.id)}
                        className="hover:bg-warning/10 text-warning rounded-lg p-2"
                      >
                        {user.status === "active" ? (
                          <Ban className="h-4 w-4" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => removeUser(user.id)}
                        className="hover:bg-danger/10 text-danger rounded-lg p-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-text-muted py-16 text-center">
            <Users className="mx-auto mb-2 h-8 w-8" />
            Tidak ada pengguna ditemukan.
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Pengguna" : "Tambah Pengguna"}
        size="md"
      >
        <form onSubmit={saveUser} className="space-y-4">
          <Input
            label="Nama Lengkap"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-text-secondary text-sm">
              Role
              <select
                className="bg-bg-elevated border-border mt-1 h-10 w-full rounded-lg border px-3"
                value={form.role}
                onChange={(event) =>
                  setForm({
                    ...form,
                    role: event.target.value as ManagedUser["role"],
                  })
                }
              >
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
                <option value="member">Member</option>
              </select>
            </label>
            <label className="text-text-secondary text-sm">
              Status
              <select
                className="bg-bg-elevated border-border mt-1 h-10 w-full rounded-lg border px-3"
                value={form.status}
                onChange={(event) =>
                  setForm({
                    ...form,
                    status: event.target.value as ManagedUser["status"],
                  })
                }
              >
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </label>
          </div>
          {!editing && (
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              hint="Minimal 6 karakter"
            />
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit">Simpan</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Detail Pengguna"
        size="md"
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="bg-warning/15 text-warning flex h-14 w-14 items-center justify-center rounded-full font-bold">
                {initials(detail.name)}
              </div>
              <div>
                <h3 className="text-lg font-bold">{detail.name}</h3>
                <p className="text-text-muted text-sm">{detail.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-bg-elevated rounded-xl p-4">
                <p className="text-text-muted text-xs">Transaksi</p>
                <p className="mt-1 text-xl font-bold">{detail.transactions}</p>
              </div>
              <div className="bg-bg-elevated rounded-xl p-4">
                <p className="text-text-muted text-xs">Dompet</p>
                <p className="mt-1 text-xl font-bold">{detail.wallets}</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Aktivitas Terbaru</p>
              {[
                "Login dari Chrome Windows",
                "Menambah transaksi",
                "Mengubah anggaran",
                "Export laporan CSV",
                "Memperbarui profil",
              ].map((item, index) => (
                <div
                  key={item}
                  className="bg-bg-elevated flex justify-between rounded-lg p-3 text-sm"
                >
                  <span>{item}</span>
                  <span className="text-text-muted">{index + 1} hari lalu</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDetail(null);
                  openEdit(detail);
                }}
              >
                Edit
              </Button>
              <Button variant="danger" onClick={() => removeUser(detail.id)}>
                Hapus
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
