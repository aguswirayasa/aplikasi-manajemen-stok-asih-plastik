"use client";

import { useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { InlineEdit } from "@/components/variations/InlineEdit";
import type { VariationValue } from "@/types/variations";

export function VariationValueChip({
  value,
  onDelete,
  onRename,
}: {
  value: VariationValue;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, newName: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(value.id);
    } finally {
      setDeleting(false);
    }
  };

  const inUse = (value._count?.productVariantValues ?? 0) > 0;

  return (
    <span className="group inline-flex items-center gap-1 rounded-full border border-[#c5c0b1] bg-[#fffefb] px-3 py-1 text-sm text-[#36342e] transition-colors hover:border-[#b5b2aa]">
      {editing ? (
        <InlineEdit
          initialValue={value.value}
          onSave={async (v) => {
            await onRename(value.id, v);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <span>{value.value}</span>
          {inUse && (
            <span
              className="ml-0.5 text-[10px] text-[#939084]"
              title={`Digunakan ${value._count?.productVariantValues} SKU`}
            >
              ({value._count?.productVariantValues})
            </span>
          )}
          <span className="ml-1 hidden items-center gap-0.5 group-hover:inline-flex">
            <button
              onClick={() => setEditing(true)}
              className="p-0.5 text-[#939084] hover:text-[#201515]"
              title="Edit"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <ConfirmAction
              title="Hapus nilai variasi"
              message={`Hapus nilai "${value.value}"?`}
              confirmLabel="Hapus"
              disabled={deleting || inUse}
              onConfirm={handleDelete}
              trigger={(open) => (
                <button
                  onClick={open}
                  disabled={deleting || inUse}
                  title={
                    inUse ? "Tidak bisa dihapus: sedang digunakan SKU" : "Hapus"
                  }
                  className="p-0.5 text-[#939084] transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {deleting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              )}
            />
          </span>
        </>
      )}
    </span>
  );
}
