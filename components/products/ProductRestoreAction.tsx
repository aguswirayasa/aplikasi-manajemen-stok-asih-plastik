"use client";

import { useRouter } from "next/navigation";
import { ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/ui/confirm-action";

type ProductRestoreActionProps = {
  productId: string;
  productName: string;
  compact?: boolean;
};

type RestoreResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

export function ProductRestoreAction({
  productId,
  productName,
  compact = false,
}: ProductRestoreActionProps) {
  const router = useRouter();

  const handleRestore = async () => {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
      });
      const data = (await response.json()) as RestoreResponse;

      if (!response.ok) {
        throw new Error(data.error || "Gagal memulihkan produk.");
      }

      toast.success(data.message || "Produk berhasil dipulihkan.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memulihkan produk.",
      );
    }
  };

  return (
    <ConfirmAction
      title="Pulihkan produk"
      message={`Pulihkan "${productName}" ke katalog aktif? Produk akan kembali muncul di daftar aktif dan dapat digunakan lagi.`}
      confirmLabel="Pulihkan"
      onConfirm={handleRestore}
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          aria-label={`Pulihkan ${productName}`}
          className={
            compact
              ? "inline-flex items-center gap-2 rounded-[4px] border border-emerald-200 px-3 py-1.5 text-[14px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
              : "inline-flex min-h-11 items-center justify-center gap-2 rounded-[5px] border border-emerald-200 bg-[#fffefb] px-4 text-[14px] font-bold text-emerald-700 hover:bg-emerald-50"
          }
        >
          <ArchiveRestore className="h-4 w-4" />
          Pulihkan
        </button>
      )}
    />
  );
}
