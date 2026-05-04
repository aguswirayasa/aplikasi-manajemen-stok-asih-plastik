"use client";

import { AlertCircle, Loader2, Pencil, Plus, Tags } from "lucide-react";
import { AddVariationTypeForm } from "@/components/variations/AddVariationTypeForm";
import { VariationTypeCard } from "@/components/variations/VariationTypeCard";
import { useVariationTypes } from "@/hooks/variations/useVariationTypes";

export function VariationManagementClient() {
  const {
    types,
    loading,
    error,
    fetchTypes,
    addTypeToState,
    handleTypeRename,
    handleTypeDelete,
    handleValueAdd,
    handleValueRename,
    handleValueDelete,
  } = useVariationTypes();

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
            Variasi Global
          </h1>
          <p className="mt-1 text-sm text-[#939084]">
            Kelola tipe dan nilai variasi yang dapat digunakan di semua produk.
          </p>
        </div>
        <AddVariationTypeForm onAdded={addTypeToState} />
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
          <button onClick={fetchTypes} className="ml-auto text-sm underline">
            Coba lagi
          </button>
        </div>
      ) : types.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#c5c0b1] bg-[#fffefb] py-20 text-center">
          <Tags className="mb-4 h-10 w-10 text-[#c5c0b1]" />
          <h3 className="mb-1 text-base font-semibold text-[#201515]">
            Belum ada tipe variasi
          </h3>
          <p className="max-w-xs text-sm text-[#939084]">
            Tambahkan tipe variasi seperti &quot;Warna&quot;, &quot;Ukuran&quot;,
            atau &quot;Ketebalan&quot; untuk mulai mengorganisir produk Anda.
          </p>
          <button
            onClick={() => document.getElementById("btn-add-type")?.click()}
            className="mt-5 inline-flex items-center gap-2 rounded bg-[#ff4f00] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#cc3f00]"
          >
            <Plus className="h-4 w-4" /> Tambah Tipe Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {types.map((type) => (
            <VariationTypeCard
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
        <div className="flex flex-wrap gap-4 border-t border-[#eceae3] pt-4 text-xs text-[#939084]">
          <span className="flex items-center gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Hover pada chip untuk edit /
            hapus
          </span>
          <span className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> Nilai/tipe yang sedang
            digunakan tidak bisa dihapus
          </span>
        </div>
      )}
    </div>
  );
}
