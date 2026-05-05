"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { PackageMinus, ReceiptText } from "lucide-react";
import { StockOutCartLine } from "@/components/stock/StockOutCartLine";
import { StockOutSummary } from "@/components/stock/StockOutSummary";
import { getStockVariantPrice } from "@/lib/stock-format";
import type { StockLine } from "@/types/stock";
import {
  StockVariantOption,
  VariantSelect,
} from "@/components/stock/VariantSelect";

const CASHIER_SALE_NOTE = "Transaksi penjualan kasir";

function newLine(variant: StockVariantOption): StockLine {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    lineId: `${variant.id}-${randomPart}`,
    variant,
    quantity: 1,
  };
}

export default function StockOutPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [lines, setLines] = useState<StockLine[]>([]);
  const [loading, setLoading] = useState(false);

  const hasInvalidQuantity = lines.some(
    (line) => typeof line.quantity !== "number" || line.quantity <= 0,
  );
  const hasOverStock = lines.some(
    (line) =>
      typeof line.quantity === "number" && line.quantity > line.variant.stock,
  );
  const totals = useMemo(
    () =>
      lines.reduce(
        (summary, line) => {
          const quantity =
            typeof line.quantity === "number" ? line.quantity : 0;
          return {
            quantity: summary.quantity + quantity,
            amount:
              summary.amount + quantity * getStockVariantPrice(line.variant),
          };
        },
        { quantity: 0, amount: 0 },
      ),
    [lines],
  );

  const cashierName =
    session?.user?.name || session?.user?.username || "Kasir aktif";

  const handleAddVariant = (variant: StockVariantOption) => {
    const existingLine = lines.find((line) => line.variant.id === variant.id);

    if (existingLine) {
      updateQuantity(
        existingLine.lineId,
        typeof existingLine.quantity === "number"
          ? existingLine.quantity + 1
          : 1,
      );
      toast.success("Jumlah SKU ditambah.");
      return;
    }

    setLines((current) => [...current, newLine(variant)]);
  };

  const updateQuantity = (lineId: string, quantity: number | "") => {
    setLines((current) =>
      current.map((line) =>
        line.lineId === lineId ? { ...line, quantity } : line,
      ),
    );
  };

  const removeLine = (lineId: string) => {
    setLines((current) => current.filter((line) => line.lineId !== lineId));
  };

  const clearCart = () => {
    setLines([]);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (lines.length === 0) {
      toast.error("Tambahkan minimal satu SKU.");
      return;
    }

    if (hasInvalidQuantity) {
      toast.error("Setiap SKU harus punya jumlah keluar yang valid.");
      return;
    }

    if (hasOverStock) {
      toast.error("Ada jumlah keluar yang melebihi stok tersedia.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/stock/out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((line) => ({
            variantId: line.variant.id,
            quantity: line.quantity,
          })),
          note: CASHIER_SALE_NOTE,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal mencatat transaksi kasir.");
      }

      toast.success(data.message || "Transaksi kasir berhasil dicatat.");
      clearCart();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mencatat transaksi kasir.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-[1180px] pb-8">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-start gap-3">
          <PackageMinus className="mt-1 h-7 w-7 text-[#ff4f00]" />
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
              POS Kasir
            </p>
            <h1 className="text-[30px] font-semibold leading-[1] text-[#201515]">
              Checkout Barang Keluar
            </h1>
            <p className="mt-1 text-[15px] leading-[1.25] text-[#939084]">
              Cari SKU, susun cart, cek stok, lalu selesaikan transaksi.
            </p>
          </div>
        </div>
        <div className="rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-4 py-3 text-[13px]">
          <p className="font-semibold uppercase tracking-[0.5px] text-[#939084]">
            Kasir
          </p>
          <p className="mt-1 font-bold text-[#201515]">{cashierName}</p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]">
          <div className="border-b border-[#c5c0b1] p-4 sm:p-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block text-[14px] font-bold text-[#201515]">
                Cari dan tambah produk
              </label>
              <span className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
                {lines.length} item
              </span>
            </div>
            <VariantSelect onSelect={handleAddVariant} error={hasOverStock} />
          </div>

          <div className="p-4 sm:p-5">
            {lines.length === 0 ? (
              <div className="rounded-[8px] border border-dashed border-[#c5c0b1] bg-[#fffefb] p-8 text-center">
                <ReceiptText className="mx-auto mb-3 h-9 w-9 text-[#c5c0b1]" />
                <p className="text-[16px] font-bold text-[#201515]">
                  Cart masih kosong
                </p>
                <p className="mt-1 text-[13px] text-[#939084]">
                  Cari SKU atau nama produk, lalu pilih item untuk mulai
                  checkout.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {lines.map((line, index) => (
                  <StockOutCartLine
                    key={line.lineId}
                    index={index}
                    line={line}
                    onQuantityChange={updateQuantity}
                    onRemove={removeLine}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <StockOutSummary
          lineCount={lines.length}
          totalQuantity={totals.quantity}
          totalAmount={totals.amount}
          hasOverStock={hasOverStock}
          loading={loading}
          submitDisabled={
            loading || lines.length === 0 || hasInvalidQuantity || hasOverStock
          }
          onClearCart={clearCart}
        />
      </div>
    </form>
  );
}
