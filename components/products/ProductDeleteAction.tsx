"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/ui/confirm-action";

type ProductDeleteActionProps = {
  productId: string;
  productName: string;
  redirectTo?: string;
  compact?: boolean;
};

type DeleteResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

export function ProductDeleteAction({
  productId,
  productName,
  redirectTo,
  compact = false,
}: ProductDeleteActionProps) {
  const router = useRouter();

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as DeleteResponse;

      if (!response.ok) {
        throw new Error(data.error || "Gagal menghapus produk.");
      }

      toast.success(data.message || "Produk berhasil dihapus.");

      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menghapus produk.",
      );
    }
  };

  return (
    <ConfirmAction
      title="Hapus produk"
      message={`Hapus "${productName}"? Jika produk sudah memiliki stok atau riwayat stok, produk akan diarsipkan agar riwayat tetap tersimpan.`}
      confirmLabel="Hapus"
      onConfirm={handleDelete}
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          aria-label={`Hapus ${productName}`}
          className={
            compact
              ? "inline-flex items-center gap-2 rounded-[4px] border border-red-200 px-3 py-1.5 text-[14px] font-semibold text-red-700 transition-colors hover:bg-red-50"
              : "inline-flex min-h-11 items-center justify-center gap-2 rounded-[5px] border border-red-200 bg-[#fffefb] px-4 text-[14px] font-bold text-red-700 hover:bg-red-50"
          }
        >
          <Trash2 className="h-4 w-4" />
          Hapus
        </button>
      )}
    />
  );
}
