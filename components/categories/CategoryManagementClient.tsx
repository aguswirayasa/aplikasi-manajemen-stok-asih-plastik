"use client";

import { useState } from "react";
import {
  AlertCircle,
  Loader2,
  Pencil,
  Plus,
  Tags,
  Trash2,
} from "lucide-react";
import { CategoryQuickAdd } from "@/components/categories/CategoryQuickAdd";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { InlineEdit } from "@/components/variations/InlineEdit";
import { useCategories } from "@/hooks/categories/useCategories";
import type { Category } from "@/types/categories";

export function CategoryManagementClient() {
  const {
    categories,
    loading,
    error,
    fetchCategories,
    addCategoryToState,
    handleCategoryRename,
    handleCategoryDelete,
  } = useCategories();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Tags className="h-5 w-5 text-[#ff4f00]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[#939084]">
              Manajemen
            </span>
          </div>
          <h1 className="text-2xl font-semibold leading-tight text-[#201515]">
            Kategori Produk
          </h1>
          <p className="mt-1 text-sm text-[#939084]">
            Kelola kategori yang dipakai untuk mengelompokkan produk.
          </p>
        </div>
        <CategoryQuickAdd onCreated={addCategoryToState} />
      </div>

      <div className="border-t border-[#eceae3]" />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#939084]" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">Gagal memuat data</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
          <button onClick={fetchCategories} className="ml-auto text-sm underline">
            Coba lagi
          </button>
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#c5c0b1] bg-[#fffefb] py-20 text-center">
          <Tags className="mb-4 h-10 w-10 text-[#c5c0b1]" />
          <h3 className="mb-1 text-base font-semibold text-[#201515]">
            Belum ada kategori
          </h3>
          <p className="max-w-xs text-sm text-[#939084]">
            Tambahkan kategori seperti &quot;Plastik&quot;, &quot;Kertas&quot;,
            atau &quot;Kardus&quot; untuk mulai mengelompokkan produk.
          </p>
          <button
            onClick={() =>
              document.querySelector<HTMLButtonElement>("[data-category-add]")?.click()
            }
            className="mt-5 inline-flex items-center gap-2 rounded bg-[#ff4f00] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#cc3f00]"
          >
            <Plus className="h-4 w-4" /> Tambah Kategori Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              onRename={handleCategoryRename}
              onDelete={handleCategoryDelete}
            />
          ))}
        </div>
      )}

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-4 border-t border-[#eceae3] pt-4 text-xs text-[#939084]">
          <span className="flex items-center gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Gunakan ikon pensil untuk edit nama
          </span>
          <span className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> Kategori yang dipakai produk
            tidak bisa dihapus
          </span>
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  category,
  onRename,
  onDelete,
}: {
  category: Category;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const productCount = category._count?.products ?? 0;
  const inUse = productCount > 0;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(category.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article className="flex items-center gap-3 rounded-lg border border-[#c5c0b1] bg-[#fffefb] px-5 py-4">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-[#eceae3] text-[#ff4f00]">
        <Tags className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        {editing ? (
          <InlineEdit
            initialValue={category.name}
            onSave={async (value) => {
              await onRename(category.id, value);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
            placeholder="Nama kategori..."
          />
        ) : (
          <h3 className="truncate text-base font-semibold leading-tight text-[#201515]">
            {category.name}
          </h3>
        )}
        <p className="mt-0.5 text-xs text-[#939084]">
          {productCount} produk menggunakan kategori ini
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded p-1.5 text-[#939084] transition-colors hover:bg-[#eceae3] hover:text-[#201515]"
          title="Edit nama"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <ConfirmAction
          title="Hapus kategori"
          message={`Hapus kategori "${category.name}"? Kategori yang sudah dipakai produk tidak bisa dihapus.`}
          confirmLabel="Hapus"
          disabled={deleting || inUse}
          onConfirm={handleDelete}
          trigger={(open) => (
            <button
              type="button"
              onClick={open}
              disabled={deleting || inUse}
              title={
                inUse
                  ? "Tidak bisa dihapus: kategori digunakan produk"
                  : "Hapus kategori"
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
    </article>
  );
}
