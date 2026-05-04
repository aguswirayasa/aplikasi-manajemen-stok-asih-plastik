"use client";

import { useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { VariationValue } from "@/types/variations";

export function AddVariationValueForm({
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
    if (!val.trim()) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/variations/values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: val.trim(), variationTypeId: typeId }),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || "Gagal menambah nilai");
        return;
      }

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
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#c5c0b1] px-3 py-1 text-xs text-[#939084] transition-colors hover:border-[#ff4f00] hover:text-[#ff4f00]"
      >
        <Plus className="h-3 w-3" /> Tambah nilai
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleAdd();
          }

          if (e.key === "Escape") {
            setOpen(false);
            setVal("");
          }
        }}
        placeholder="Nilai baru..."
        className="w-32 rounded border border-[#ff4f00] bg-[#fffefb] px-2 py-0.5 text-sm text-[#201515] focus:outline-none"
      />
      <button
        onClick={handleAdd}
        disabled={saving}
        className="text-[#ff4f00] hover:text-[#cc3f00]"
        title="Tambah"
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
      </button>
      <button
        onClick={() => {
          setOpen(false);
          setVal("");
        }}
        className="text-[#939084] hover:text-[#201515]"
        title="Batal"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
