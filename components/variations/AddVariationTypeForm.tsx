"use client";

import { useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { VariationType } from "@/types/variations";

export function AddVariationTypeForm({
  onAdded,
}: {
  onAdded: (t: VariationType) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/variations/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || "Gagal membuat tipe");
        return;
      }

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
        className="inline-flex items-center gap-2 rounded bg-[#ff4f00] px-4 py-2 text-sm font-semibold text-[#fffefb] transition-colors hover:bg-[#cc3f00]"
      >
        <Plus className="h-4 w-4" />
        Tambah Tipe Variasi
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#ff4f00] bg-[#fffefb] p-4">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleAdd();
          }

          if (e.key === "Escape") {
            setOpen(false);
            setName("");
          }
        }}
        placeholder="Nama tipe (cth: Warna, Ukuran, Ketebalan)"
        className="flex-1 border-0 bg-transparent text-sm text-[#201515] placeholder:text-[#939084] focus:outline-none"
      />
      <button
        onClick={handleAdd}
        disabled={saving || !name.trim()}
        className="inline-flex items-center gap-1.5 rounded bg-[#ff4f00] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#cc3f00] disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        Simpan
      </button>
      <button
        onClick={() => {
          setOpen(false);
          setName("");
        }}
        className="rounded p-1.5 text-[#939084] transition-colors hover:bg-[#eceae3] hover:text-[#201515]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
