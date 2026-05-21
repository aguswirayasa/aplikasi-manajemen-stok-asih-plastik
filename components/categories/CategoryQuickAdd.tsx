"use client";

import { useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { ApiResponse } from "@/lib/api-helpers";
import type { Category } from "@/types/categories";

export function CategoryQuickAdd({
  onCreated,
  triggerLabel = "Tambah Kategori",
}: {
  onCreated: (category: Category) => void;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const close = () => {
    if (!saving) {
      setName("");
      setOpen(false);
    }
  };

  const handleAdd = async () => {
    const trimmed = name.trim();

    if (trimmed.length === 0) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = (await response.json()) as ApiResponse<Category>;

      if (!response.ok || !json.data) {
        toast.error(json.error || "Gagal membuat kategori.");
        return;
      }

      toast.success(json.message || `Kategori "${json.data.name}" berhasil dibuat.`);
      onCreated(json.data);
      setName("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        data-category-add
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[5px] border border-[#ff4f00] px-4 text-[14px] font-semibold text-[#ff4f00] transition-colors hover:bg-[#fff4ed]"
      >
        <Plus className="h-4 w-4" />
        {triggerLabel}
      </button>
    );
  }

  return (
    <div className="flex min-h-12 items-center gap-2 rounded-[5px] border border-[#ff4f00] bg-[#fffefb] px-3">
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            void handleAdd();
          }

          if (event.key === "Escape") {
            close();
          }
        }}
        placeholder="Nama kategori"
        className="min-w-0 flex-1 bg-transparent text-[14px] text-[#201515] outline-none placeholder:text-[#939084]"
      />
      <button
        type="button"
        onClick={() => void handleAdd()}
        disabled={saving || name.trim().length === 0}
        className="rounded p-1.5 text-[#ff4f00] transition-colors hover:bg-[#fff4ed] disabled:opacity-40"
        title="Simpan kategori"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        onClick={close}
        disabled={saving}
        className="rounded p-1.5 text-[#939084] transition-colors hover:bg-[#eceae3] hover:text-[#201515] disabled:opacity-40"
        title="Batal"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
