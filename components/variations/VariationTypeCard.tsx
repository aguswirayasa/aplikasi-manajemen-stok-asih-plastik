"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { AddVariationValueForm } from "@/components/variations/AddVariationValueForm";
import { InlineEdit } from "@/components/variations/InlineEdit";
import { VariationValueChip } from "@/components/variations/VariationValueChip";
import type {
  VariationType,
  VariationValue,
} from "@/types/variations";

export function VariationTypeCard({
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
  onValueRename: (
    typeId: string,
    valId: string,
    newName: string
  ) => Promise<void>;
  onValueDelete: (typeId: string, valId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const inUse = (type._count?.productVariationTypes ?? 0) > 0;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onTypeDelete(type.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-lg border border-[#c5c0b1] bg-[#fffefb]">
      <div className="flex items-center gap-3 border-b border-[#eceae3] px-5 py-4">
        <button
          onClick={() => setExpanded((p) => !p)}
          className="flex-shrink-0 text-[#939084] transition-colors hover:text-[#201515]"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          {editingName ? (
            <InlineEdit
              initialValue={type.name}
              onSave={async (v) => {
                await onTypeRename(type.id, v);
                setEditingName(false);
              }}
              onCancel={() => setEditingName(false)}
              placeholder="Nama tipe..."
            />
          ) : (
            <h3 className="text-base font-semibold leading-tight text-[#201515]">
              {type.name}
            </h3>
          )}
          <p className="mt-0.5 text-xs text-[#939084]">
            {type.values.length} nilai
            {inUse &&
              ` - digunakan ${type._count?.productVariationTypes} produk`}
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            onClick={() => setEditingName(true)}
            className="rounded p-1.5 text-[#939084] transition-colors hover:bg-[#eceae3] hover:text-[#201515]"
            title="Edit nama"
          >
            <Pencil className="h-4 w-4" />
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
                title={
                  inUse ? "Tidak bisa dihapus: tipe digunakan produk" : "Hapus tipe"
                }
                className="rounded p-1.5 text-[#939084] transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            )}
          />
        </div>
      </div>

      {expanded && (
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {type.values.map((value) => (
              <VariationValueChip
                key={value.id}
                value={value}
                onDelete={async (id) => await onValueDelete(type.id, id)}
                onRename={async (id, name) =>
                  await onValueRename(type.id, id, name)
                }
              />
            ))}
            <AddVariationValueForm
              typeId={type.id}
              onAdded={(value) => onValueAdd(type.id, value)}
            />
          </div>
          {type.values.length === 0 && (
            <p className="text-sm italic text-[#939084]">
              Belum ada nilai. Tambahkan di atas.
            </p>
          )}
        </div>
      )}
    </article>
  );
}
