"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Edit,
  Plus,
  Shield,
  Trash2,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/ui/confirm-action";

type UserRole = "ADMIN" | "PEGAWAI";

type ManagedUser = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};

type UserManagementClientProps = {
  currentUserId: string;
};

const emptyForm = {
  username: "",
  name: "",
  password: "",
  role: "PEGAWAI" as UserRole,
  isActive: true,
};

export function UserManagementClient({
  currentUserId,
}: UserManagementClientProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const activeAdminCount = useMemo(
    () =>
      users.filter((item) => item.role === "ADMIN" && item.isActive).length,
    [users]
  );

  const editingUser = users.find((item) => item.id === editingId);
  const isEditingSelf = editingId === currentUserId;
  const isLastActiveAdmin =
    editingUser?.role === "ADMIN" &&
    editingUser.isActive &&
    activeAdminCount <= 1;

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal memuat user.");
      }

      setUsers(data.data || []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memuat user."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  };

  const openEditForm = (user: ManagedUser) => {
    setEditingId(user.id);
    setForm({
      username: user.username,
      name: user.name,
      password: "",
      role: user.role,
      isActive: user.isActive,
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!form.username.trim() || !form.name.trim()) {
      toast.error("Username dan nama wajib diisi.");
      return;
    }

    if (!editingId && !form.password.trim()) {
      toast.error("Password wajib diisi untuk user baru.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        editingId ? `/api/users/${editingId}` : "/api/users",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: form.username.trim(),
            name: form.name.trim(),
            password: form.password,
            role: form.role,
            ...(editingId ? { isActive: form.isActive } : {}),
          }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal menyimpan user.");
      }

      toast.success(editingId ? "User diperbarui." : "User baru dibuat.");
      await fetchUsers();
      resetForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan user."
      );
    } finally {
      setSaving(false);
    }
  };

  const setUserActive = async (user: ManagedUser, nextIsActive: boolean) => {
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: nextIsActive ? "PUT" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: nextIsActive
          ? JSON.stringify({
              name: user.name,
              role: user.role,
              isActive: true,
            })
          : undefined,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal mengubah status user.");
      }

      toast.success(nextIsActive ? "User diaktifkan kembali." : "User dinonaktifkan.");
      await fetchUsers();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal mengubah status user."
      );
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-start gap-3">
          <Users className="mt-1 h-7 w-7 text-[#ff4f00]" />
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
              Akses sistem
            </p>
            <h1 className="text-[30px] font-semibold leading-[1] text-[#201515]">
              Manajemen User
            </h1>
            <p className="mt-2 max-w-[620px] text-[15px] leading-[1.25] text-[#36342e]">
              Kelola admin dan pegawai tanpa menghapus jejak transaksi stok.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[5px] border border-[#ff4f00] bg-[#ff4f00] px-5 text-[15px] font-bold text-[#fffefb] transition-colors hover:bg-[#e64600] md:w-auto"
        >
          <Plus className="h-4 w-4" />
          Tambah User
        </button>
      </header>

      {isFormOpen && (
        <section className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]">
          <div className="border-b border-[#c5c0b1] bg-[#eceae3]/35 p-4">
            <h2 className="text-[18px] font-bold text-[#201515]">
              {editingId ? "Edit User" : "User Baru"}
            </h2>
            <p className="mt-1 text-[13px] text-[#939084]">
              {editingId
                ? "Password boleh dikosongkan jika tidak ingin diubah."
                : "User baru langsung aktif setelah dibuat."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-4 sm:p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Username">
                <input
                  type="text"
                  required
                  disabled={!!editingId}
                  value={form.username}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                  className="min-h-11 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[15px] text-[#201515] outline-none focus:border-[#ff4f00] disabled:bg-[#eceae3]"
                />
              </Field>

              <Field label="Nama lengkap">
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="min-h-11 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[15px] text-[#201515] outline-none focus:border-[#ff4f00]"
                />
              </Field>

              <Field
                label={
                  editingId
                    ? "Password baru (opsional)"
                    : "Password awal"
                }
              >
                <input
                  type="password"
                  required={!editingId}
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  className="min-h-11 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[15px] text-[#201515] outline-none focus:border-[#ff4f00]"
                />
              </Field>

              <Field label="Role">
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      role: event.target.value as UserRole,
                    }))
                  }
                  className="min-h-11 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[15px] text-[#201515] outline-none focus:border-[#ff4f00]"
                >
                  <option value="PEGAWAI">PEGAWAI</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </Field>
            </div>

            {editingId && (
              <label className="flex min-h-12 items-center justify-between gap-4 rounded-[8px] border border-[#c5c0b1] bg-[#eceae3]/35 px-4 py-3">
                <span>
                  <span className="block text-[14px] font-bold text-[#201515]">
                    User aktif
                  </span>
                  <span className="block text-[12px] text-[#939084]">
                    User nonaktif tidak bisa login.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  disabled={isEditingSelf || isLastActiveAdmin}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                  className="h-5 w-5 accent-[#ff4f00]"
                />
              </label>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="min-h-11 rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-5 text-[14px] font-bold text-[#36342e] hover:bg-[#eceae3]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center rounded-[5px] border border-[#201515] bg-[#201515] px-5 text-[14px] font-bold text-[#fffefb] hover:bg-[#36342e] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Simpan User"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]">
        <div className="flex items-center justify-between gap-3 border-b border-[#c5c0b1] bg-[#eceae3]/35 p-4">
          <div>
            <h2 className="text-[17px] font-bold text-[#201515]">
              Daftar User
            </h2>
            <p className="mt-1 text-[13px] text-[#939084]">
              {users.length} user terdaftar, {activeAdminCount} admin aktif.
            </p>
          </div>
          <span className="rounded-[20px] border border-[#c5c0b1] bg-[#fffefb] px-3 py-1.5 text-[12px] font-bold text-[#201515]">
            {users.filter((item) => item.isActive).length} aktif
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[14px] text-[#939084]">
            Memuat user...
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[16px] font-bold text-[#201515]">
              Belum ada user
            </p>
            <p className="mt-1 text-[14px] text-[#939084]">
              Tambahkan admin atau pegawai untuk mulai berbagi akses.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#c5c0b1]">
                    <th className="p-4 text-[13px] font-bold text-[#201515]">
                      User
                    </th>
                    <th className="p-4 text-[13px] font-bold text-[#201515]">
                      Role
                    </th>
                    <th className="p-4 text-[13px] font-bold text-[#201515]">
                      Status
                    </th>
                    <th className="p-4 text-right text-[13px] font-bold text-[#201515]">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <UserTableRow
                      key={user.id}
                      user={user}
                      currentUserId={currentUserId}
                      activeAdminCount={activeAdminCount}
                      onEdit={openEditForm}
                      onSetActive={setUserActive}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[#eceae3] md:hidden">
              {users.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  currentUserId={currentUserId}
                  activeAdminCount={activeAdminCount}
                  onEdit={openEditForm}
                  onSetActive={setUserActive}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-bold text-[#201515]">
        {label}
      </span>
      {children}
    </label>
  );
}

function UserTableRow({
  user,
  currentUserId,
  activeAdminCount,
  onEdit,
  onSetActive,
}: UserRowProps) {
  return (
    <tr className="border-b border-[#eceae3] last:border-0 hover:bg-[#eceae3]/25">
      <td className="p-4">
        <UserIdentity user={user} />
      </td>
      <td className="p-4">
        <RoleBadge role={user.role} />
      </td>
      <td className="p-4">
        <StatusBadge isActive={user.isActive} />
      </td>
      <td className="p-4">
        <UserActions
          user={user}
          currentUserId={currentUserId}
          activeAdminCount={activeAdminCount}
          onEdit={onEdit}
          onSetActive={onSetActive}
        />
      </td>
    </tr>
  );
}

function UserCard({
  user,
  currentUserId,
  activeAdminCount,
  onEdit,
  onSetActive,
}: UserRowProps) {
  return (
    <article className="border-l-4 border-l-[#ff4f00] p-4">
      <div className="flex items-start justify-between gap-3">
        <UserIdentity user={user} />
        <StatusBadge isActive={user.isActive} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <RoleBadge role={user.role} />
        <UserActions
          user={user}
          currentUserId={currentUserId}
          activeAdminCount={activeAdminCount}
          onEdit={onEdit}
          onSetActive={onSetActive}
        />
      </div>
    </article>
  );
}

type UserRowProps = {
  user: ManagedUser;
  currentUserId: string;
  activeAdminCount: number;
  onEdit: (user: ManagedUser) => void;
  onSetActive: (user: ManagedUser, nextIsActive: boolean) => void;
};

function UserIdentity({ user }: { user: ManagedUser }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[15px] font-bold text-[#201515]">
        {user.name}
      </p>
      <p className="truncate text-[13px] text-[#939084]">@{user.username}</p>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-[20px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[12px] font-bold text-[#201515]">
      {role === "ADMIN" ? (
        <Shield className="h-3.5 w-3.5 text-[#ff4f00]" />
      ) : (
        <User className="h-3.5 w-3.5 text-[#ff4f00]" />
      )}
      {role}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-[20px] border px-3 text-[12px] font-bold ${
        isActive
          ? "border-[#c5c0b1] bg-[#fffefb] text-[#201515]"
          : "border-[#c5c0b1] bg-[#eceae3] text-[#939084]"
      }`}
    >
      {isActive ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-[#ff4f00]" />
      ) : (
        <UserCheck className="h-3.5 w-3.5 text-[#939084]" />
      )}
      {isActive ? "Aktif" : "Nonaktif"}
    </span>
  );
}

function UserActions({
  user,
  currentUserId,
  activeAdminCount,
  onEdit,
  onSetActive,
}: UserRowProps) {
  const isSelf = user.id === currentUserId;
  const isLastActiveAdmin =
    user.role === "ADMIN" && user.isActive && activeAdminCount <= 1;
  const statusDisabled = isSelf || isLastActiveAdmin;

  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={() => onEdit(user)}
        className="inline-flex min-h-10 items-center justify-center rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[#36342e] hover:bg-[#eceae3] hover:text-[#201515]"
        aria-label={`Edit ${user.name}`}
      >
        <Edit className="h-4 w-4" />
      </button>
      {user.isActive ? (
        <ConfirmAction
          title="Nonaktifkan user"
          message={`Nonaktifkan ${user.name}? User ini tidak bisa login sampai diaktifkan kembali.`}
          confirmLabel="Nonaktifkan"
          disabled={statusDisabled}
          onConfirm={() => onSetActive(user, false)}
          trigger={(open) => (
            <button
              type="button"
              disabled={statusDisabled}
              onClick={open}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[13px] font-bold text-[#36342e] hover:bg-[#eceae3] hover:text-[#201515] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Nonaktifkan</span>
            </button>
          )}
        />
      ) : (
        <button
          type="button"
          disabled={statusDisabled}
          onClick={() => onSetActive(user, true)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[13px] font-bold text-[#36342e] hover:bg-[#eceae3] hover:text-[#201515] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <UserCheck className="h-4 w-4" />
          <span className="hidden sm:inline">Aktifkan</span>
        </button>
      )}
    </div>
  );
}
