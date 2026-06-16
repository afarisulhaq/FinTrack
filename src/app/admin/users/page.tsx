"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Ban,
  CheckCircle2,
  Eye,
  Users,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Modal } from "~/components/ui/modal";
import { Badge } from "~/components/ui/badge";
import { confirm } from "~/components/ui/confirm-dialog";
import { toast } from "~/components/ui/toast";
import { api } from "~/lib/api";
import { useAuthStore } from "~/store/useAuthStore";

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "owner" | "member";
  status: "active" | "inactive" | "pending";
  joinedAt: string;
  transactions: number;
  wallets: number;
  createdAt?: string;
}

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

function formatJoinedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminUsersPage() {
  const token = useAuthStore((state) => state.token);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<ManagedUser | null>(null);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState(emptyForm);

  // ── Fetch real users from the backend ────────────────────────────
  // The previous version of this page shipped with 11 hardcoded
  // `initialUsers` so the table looked populated, which made any
  // delete/refresh round-trip confusing (the rows came right back).
  // Now we hit `GET /api/users` on mount and show whatever's actually
  // in the database. Add / edit / delete are not yet wired to the
  // backend, so changes stay local until the matching POST/PUT/DELETE
  // endpoints are added.
  const loadUsers = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await api.get<
        Array<{
          id: string;
          name: string;
          email: string;
          role: string;
          status: string;
          createdAt: string;
        }>
      >("/users", token);
      setUsers(
        rows.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role as ManagedUser["role"],
          status: u.status as ManagedUser["status"],
          joinedAt: formatJoinedAt(u.createdAt),
          transactions: 0,
          wallets: 0,
        })),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal memuat daftar pengguna";
      setLoadError(message);
      toast.error("Gagal memuat pengguna", message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

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
    if (editing) {
      // Edit existing — PUT /users/:id
      void (async () => {
        if (!token) return;
        try {
          const updated = await api.put<ManagedUser>(
            `/users/${editing.id}`,
            token,
            {
              name: form.name,
              email: form.email,
              role: form.role,
              status: form.status,
              ...(form.password ? { password: form.password } : {}),
            },
          );
          setUsers((list) =>
            list.map((u) =>
              u.id === editing.id
                ? {
                    ...u,
                    name: updated.name,
                    email: updated.email,
                    role: updated.role,
                    status: updated.status,
                  }
                : u,
            ),
          );
          toast.success("Pengguna diperbarui");
          setModalOpen(false);
        } catch (err) {
          toast.error(
            "Gagal memperbarui",
            err instanceof Error ? err.message : "Unknown error",
          );
        }
      })();
    } else {
      // Create new — POST /users
      if (!form.password) {
        toast.error("Password wajib diisi untuk pengguna baru");
        return;
      }
      void (async () => {
        if (!token) return;
        try {
          const created = await api.post<ManagedUser>("/users", token, {
            name: form.name,
            email: form.email,
            password: form.password,
            role: form.role,
            status: form.status,
          });
          setUsers((list) => [
            {
              id: created.id,
              name: created.name,
              email: created.email,
              role: created.role,
              status: created.status,
              joinedAt: formatJoinedAt(created.createdAt ?? new Date().toISOString()),
              transactions: 0,
              wallets: 0,
            },
            ...list,
          ]);
          toast.success("Pengguna ditambahkan");
          setModalOpen(false);
        } catch (err) {
          toast.error(
            "Gagal menambah",
            err instanceof Error ? err.message : "Unknown error",
          );
        }
      })();
    }
  }
  async function removeUser(id: string) {
    const ok = await confirm({
      title: "Hapus pengguna ini?",
      message:
        "Tindakan ini tidak bisa dibatalkan. Semua data milik pengguna (dompet, transaksi, dll) akan ikut terhapus.",
      variant: "danger",
    });
    if (!ok || !token) return;
    try {
      await api.delete<{ id: string }>(`/users/${id}`, token);
      setUsers((list) => list.filter((user) => user.id !== id));
      toast.success("Pengguna dihapus");
    } catch (err) {
      toast.error(
        "Gagal menghapus",
        err instanceof Error ? err.message : "Unknown error",
      );
    }
  }
  function toggleStatus(id: string) {
    const target = users.find((u) => u.id === id);
    if (!target || !token) return;
    const next: ManagedUser["status"] =
      target.status === "active" ? "inactive" : "active";
    // Optimistic update so the table feels instant; revert on error.
    setUsers((list) =>
      list.map((u) => (u.id === id ? { ...u, status: next } : u)),
    );
    void api
      .put<ManagedUser>(`/users/${id}`, token, { status: next })
      .catch((err) => {
        setUsers((list) =>
          list.map((u) =>
            u.id === id ? { ...u, status: target.status } : u,
          ),
        );
        toast.error(
          "Gagal mengubah status",
          err instanceof Error ? err.message : "Unknown error",
        );
      });
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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadUsers()}
            disabled={loading}
            leftIcon={
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            }
          >
            Refresh
          </Button>
          <Button
            onClick={openAdd}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Tambah Pengguna
          </Button>
        </div>
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
        {loading ? (
          <div className="text-text-muted flex flex-col items-center gap-2 py-16 text-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <p className="text-sm">Memuat daftar pengguna…</p>
          </div>
        ) : loadError ? (
          <div className="text-danger flex flex-col items-center gap-2 py-16 text-center">
            <AlertCircle className="h-8 w-8" />
            <p className="text-sm font-semibold">Gagal memuat pengguna</p>
            <p className="text-text-muted text-xs">{loadError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadUsers()}
              className="mt-2"
            >
              Coba lagi
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-text-muted flex flex-col items-center gap-2 py-16 text-center">
            <Users className="h-8 w-8" />
            <p className="text-sm">
              {search || role !== "all" || status !== "all"
                ? "Tidak ada pengguna yang cocok dengan filter."
                : "Belum ada pengguna lain di database."}
            </p>
          </div>
        ) : null}
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
