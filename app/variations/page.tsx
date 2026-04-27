"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Tags,
  AlertCircle,
  Check,
  X,
} from "lucide-react";
import { ConfirmAction } from "@/components/ui/confirm-action";

interface VariationValue {
  id: string;
  value: string;
  variationTypeId: string;
  _count?: { productVariantValues: number };
}

interface VariationType {
  id: string;
  name: string;
  values: VariationValue[];
  _count?: { values: number; productVariationTypes: number };
}

function InlineEdit({
  initialValue,
  onSave,
  onCancel,
  placeholder = "Nama...",
}: {
  initialValue: string;
  onSave: (v: string) => Promise<void>;
  onCancel: () => void;
  placeholder?: string;
}) {
  const [val, setVal] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!val.trim() || val.trim() === initialValue) { onCancel(); return; }
    setSaving(true);
    try { await onSave(val.trim()); } finally { setSaving(false); }
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
        placeholder={placeholder}
        className="border border-[#ff4f00] rounded px-2 py-0.5 text-sm text-[#201515] bg-[#fffefb] focus:outline-none w-36"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="text-[#ff4f00] hover:text-[#cc3f00] transition-colors"
        title="Simpan"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      </button>
      <button onClick={onCancel} className="text-[#939084] hover:text-[#201515] transition-colors" title="Batal">
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

function AddValueForm({
  typeId,
  onAdded,
}: {
  typeId: string;
  onAdded: (v: VariationValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!val.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/variations/values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: val.trim(), variationTypeId: typeId }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || "Gagal menambah nilai"); return; }
      toast.success(json.message);
      onAdded(json.data);
      setVal("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-[#939084] hover:text-[#ff4f00] transition-colors border border-dashed border-[#c5c0b1] rounded-full px-3 py-1 hover:border-[#ff4f00]"
      >
        <Plus className="w-3 h-3" /> Tambah nilai
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setOpen(false); setVal(""); } }}
        placeholder="Nilai baru..."
        className="border border-[#ff4f00] rounded px-2 py-0.5 text-sm text-[#201515] bg-[#fffefb] focus:outline-none w-32"
      />
      <button onClick={handleAdd} disabled={saving} className="text-[#ff4f00] hover:text-[#cc3f00]" title="Tambah">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      </button>
      <button onClick={() => { setOpen(false); setVal(""); }} className="text-[#939084] hover:text-[#201515]" title="Batal">
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

function ValueChip({
  val,
  onDelete,
  onRename,
}: {
  val: VariationValue;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, newName: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(val.id); } finally { setDeleting(false); }
  };

  const inUse = (val._count?.productVariantValues ?? 0) > 0;

  return (
    <span className="group inline-flex items-center gap-1 border border-[#c5c0b1] rounded-full px-3 py-1 text-sm text-[#36342e] bg-[#fffefb] hover:border-[#b5b2aa] transition-colors">
      {editing ? (
        <InlineEdit
          initialValue={val.value}
          onSave={async (v) => { await onRename(val.id, v); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <span>{val.value}</span>
          {inUse && (
            <span className="text-[10px] text-[#939084] ml-0.5" title={`Digunakan ${val._count?.productVariantValues} SKU`}>
              ({val._count?.productVariantValues})
            </span>
          )}
          <span className="hidden group-hover:inline-flex items-center gap-0.5 ml-1">
            <button onClick={() => setEditing(true)} className="text-[#939084] hover:text-[#201515] p-0.5" title="Edit">
              <Pencil className="w-3 h-3" />
            </button>
            <ConfirmAction
              title="Hapus nilai variasi"
              message={`Hapus nilai "${val.value}"?`}
              confirmLabel="Hapus"
              disabled={deleting || inUse}
              onConfirm={handleDelete}
              trigger={(open) => (
                <button
                  onClick={open}
                  disabled={deleting || inUse}
                  title={inUse ? "Tidak bisa dihapus: sedang digunakan SKU" : "Hapus"}
                  className="text-[#939084] hover:text-red-500 p-0.5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                </button>
              )}
            />
          </span>
        </>
      )}
    </span>
  );
}

function TypeCard({
  type,
  onTypeRename,
  onTypeDelete,
  onValueAdd,
  onValueRename,
  onValueDelete,
}: {
  type: VariationType;
  onTypeRename: (id: string, name: string) => Promise<void>;
  onTypeDelete: (id: string) => Promise<void>;
  onValueAdd: (typeId: string, val: VariationValue) => void;
  onValueRename: (typeId: string, valId: string, newName: string) => Promise<void>;
  onValueDelete: (typeId: string, valId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const inUse = (type._count?.productVariationTypes ?? 0) > 0;

  const handleDelete = async () => {
    setDeleting(true);
    try { await onTypeDelete(type.id); } finally { setDeleting(false); }
  };

  return (
    <article className="border border-[#c5c0b1] rounded-lg bg-[#fffefb] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#eceae3]">
        <button
          onClick={() => setExpanded((p) => !p)}
          className="text-[#939084] hover:text-[#201515] transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <div className="flex-1 min-w-0">
          {editingName ? (
            <InlineEdit
              initialValue={type.name}
              onSave={async (v) => { await onTypeRename(type.id, v); setEditingName(false); }}
              onCancel={() => setEditingName(false)}
              placeholder="Nama tipe..."
            />
          ) : (
            <h3 className="text-base font-semibold text-[#201515] leading-tight">{type.name}</h3>
          )}
          <p className="text-xs text-[#939084] mt-0.5">
            {type.values.length} nilai
            {inUse && ` · digunakan ${type._count?.productVariationTypes} produk`}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setEditingName(true)}
            className="p-1.5 rounded text-[#939084] hover:text-[#201515] hover:bg-[#eceae3] transition-colors"
            title="Edit nama"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <ConfirmAction
            title="Hapus tipe variasi"
            message={`Hapus tipe variasi "${type.name}"? Semua nilainya juga akan dihapus.`}
            confirmLabel="Hapus"
            disabled={deleting || inUse}
            onConfirm={handleDelete}
            trigger={(open) => (
              <button
                onClick={open}
                disabled={deleting || inUse}
                title={inUse ? "Tidak bisa dihapus: tipe digunakan produk" : "Hapus tipe"}
                className="p-1.5 rounded text-[#939084] hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
          />
        </div>
      </div>

      {expanded && (
        <div className="px-5 py-4">
          <div className="flex flex-wrap gap-2 items-center">
            {type.values.map((v) => (
              <ValueChip
                key={v.id}
                val={v}
                onDelete={async (id) => await onValueDelete(type.id, id)}
                onRename={async (id, name) => await onValueRename(type.id, id, name)}
              />
            ))}
            <AddValueForm typeId={type.id} onAdded={(v) => onValueAdd(type.id, v)} />
          </div>
          {type.values.length === 0 && (
            <p className="text-sm text-[#939084] italic">Belum ada nilai. Tambahkan di atas.</p>
          )}
        </div>
      )}
    </article>
  );
}

function AddTypeForm({ onAdded }: { onAdded: (t: VariationType) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/variations/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || "Gagal membuat tipe"); return; }
      toast.success(json.message);
      onAdded({ ...json.data, values: [] });
      setName("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        id="btn-add-type"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#ff4f00] text-[#fffefb] text-sm font-semibold hover:bg-[#cc3f00] transition-colors"
      >
        <Plus className="w-4 h-4" />
        Tambah Tipe Variasi
      </button>
    );
  }

  return (
    <div className="border border-[#ff4f00] rounded-lg p-4 bg-[#fffefb] flex items-center gap-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setOpen(false); setName(""); } }}
        placeholder="Nama tipe (cth: Warna, Ukuran, Ketebalan)"
        className="flex-1 text-sm text-[#201515] bg-transparent border-0 focus:outline-none placeholder:text-[#939084]"
      />
      <button
        onClick={handleAdd}
        disabled={saving || !name.trim()}
        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#ff4f00] text-white text-sm font-semibold disabled:opacity-50 hover:bg-[#cc3f00] transition-colors"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        Simpan
      </button>
      <button
        onClick={() => { setOpen(false); setName(""); }}
        className="p-1.5 rounded text-[#939084] hover:text-[#201515] hover:bg-[#eceae3] transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function VariationsPage() {
  const [types, setTypes] = useState<VariationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/variations/types");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat data");
      setTypes(json.data);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const handleTypeRename = async (id: string, name: string) => {
    const res = await fetch(`/api/variations/types/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Gagal memperbarui"); return; }
    toast.success(json.message);
    setTypes((prev) => prev.map((t) => t.id === id ? { ...t, name } : t));
  };

  const handleTypeDelete = async (id: string) => {
    const res = await fetch(`/api/variations/types/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Gagal menghapus"); return; }
    toast.success(json.message);
    setTypes((prev) => prev.filter((t) => t.id !== id));
  };

  const handleValueAdd = (typeId: string, val: VariationValue) => {
    setTypes((prev) =>
      prev.map((t) => t.id === typeId ? { ...t, values: [...t.values, val] } : t)
    );
  };

  const handleValueRename = async (typeId: string, valId: string, newName: string) => {
    const res = await fetch(`/api/variations/values/${valId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: newName }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Gagal memperbarui"); return; }
    toast.success(json.message);
    setTypes((prev) =>
      prev.map((t) =>
        t.id === typeId
          ? { ...t, values: t.values.map((v) => v.id === valId ? { ...v, value: newName } : v) }
          : t
      )
    );
  };

  const handleValueDelete = async (typeId: string, valId: string) => {
    const res = await fetch(`/api/variations/values/${valId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Gagal menghapus"); return; }
    toast.success(json.message);
    setTypes((prev) =>
      prev.map((t) =>
        t.id === typeId ? { ...t, values: t.values.filter((v) => v.id !== valId) } : t
      )
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Tags className="w-5 h-5 text-[#ff4f00]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[#939084]">
              Manajemen
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-[#201515] leading-tight">
            Variasi Global
          </h1>
          <p className="text-sm text-[#939084] mt-1">
            Kelola tipe dan nilai variasi yang dapat digunakan di semua produk.
          </p>
        </div>
        <AddTypeForm onAdded={(t) => setTypes((prev) => [...prev, t])} />
      </div>

      <div className="border-t border-[#eceae3]" />

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#939084]" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 border border-red-200 rounded-lg px-5 py-4 bg-red-50 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">Gagal memuat data</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
          <button onClick={fetchTypes} className="ml-auto text-sm underline">Coba lagi</button>
        </div>
      ) : types.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#c5c0b1] rounded-xl bg-[#fffefb]">
          <Tags className="w-10 h-10 text-[#c5c0b1] mb-4" />
          <h3 className="text-base font-semibold text-[#201515] mb-1">Belum ada tipe variasi</h3>
          <p className="text-sm text-[#939084] max-w-xs">
            Tambahkan tipe variasi seperti "Warna", "Ukuran", atau "Ketebalan" untuk mulai mengorganisir produk Anda.
          </p>
          <button
            onClick={() => document.getElementById("btn-add-type")?.click()}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded bg-[#ff4f00] text-white text-sm font-semibold hover:bg-[#cc3f00] transition-colors"
          >
            <Plus className="w-4 h-4" /> Tambah Tipe Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {types.map((type) => (
            <TypeCard
              key={type.id}
              type={type}
              onTypeRename={handleTypeRename}
              onTypeDelete={handleTypeDelete}
              onValueAdd={handleValueAdd}
              onValueRename={handleValueRename}
              onValueDelete={handleValueDelete}
            />
          ))}
        </div>
      )}

      {types.length > 0 && (
        <div className="flex flex-wrap gap-4 text-xs text-[#939084] border-t border-[#eceae3] pt-4">
          <span className="flex items-center gap-1.5">
            <Pencil className="w-3.5 h-3.5" /> Hover pada chip untuk edit / hapus
          </span>
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Nilai/tipe yang sedang digunakan tidak bisa dihapus
          </span>
        </div>
      )}
    </div>
  );
}
