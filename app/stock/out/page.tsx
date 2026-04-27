"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  AlertCircle,
  PackageMinus,
  ReceiptText,
  Save,
  Trash2,
} from "lucide-react";
import {
  StockVariantOption,
  VariantSelect,
} from "@/components/stock/VariantSelect";

type StockLine = {
  lineId: string;
  variant: StockVariantOption;
  quantity: number | "";
};

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function newLine(variant: StockVariantOption): StockLine {
  return {
    lineId: `${variant.id}-${crypto.randomUUID()}`,
    variant,
    quantity: 1,
  };
}

function getPrice(variant: StockVariantOption) {
  const price = typeof variant.price === "number" ? variant.price : Number(variant.price);
  return Number.isFinite(price) ? price : 0;
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export default function StockOutPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [lines, setLines] = useState<StockLine[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const hasInvalidQuantity = lines.some(
    (line) => typeof line.quantity !== "number" || line.quantity <= 0
  );
  const hasOverStock = lines.some(
    (line) =>
      typeof line.quantity === "number" && line.quantity > line.variant.stock
  );
  const totals = useMemo(
    () =>
      lines.reduce(
        (summary, line) => {
          const quantity = typeof line.quantity === "number" ? line.quantity : 0;
          return {
            quantity: summary.quantity + quantity,
            amount: summary.amount + quantity * getPrice(line.variant),
          };
        },
        { quantity: 0, amount: 0 }
      ),
    [lines]
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
          : 1
      );
      toast.success("Jumlah SKU ditambah.");
      return;
    }

    setLines((current) => [...current, newLine(variant)]);
  };

  const updateQuantity = (lineId: string, quantity: number | "") => {
    setLines((current) =>
      current.map((line) =>
        line.lineId === lineId ? { ...line, quantity } : line
      )
    );
  };

  const removeLine = (lineId: string) => {
    setLines((current) => current.filter((line) => line.lineId !== lineId));
  };

  const clearCart = () => {
    setLines([]);
    setNote("");
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
          note: note.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal mencatat transaksi kasir.");
      }

      toast.success(data.message || "Transaksi kasir berhasil dicatat.");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal mencatat transaksi kasir."
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
                  Cari SKU atau nama produk, lalu pilih item untuk mulai checkout.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {lines.map((line, index) => (
                  <CartLine
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

        <aside className="lg:sticky lg:top-6">
          <div className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]">
            <div className="border-b border-[#c5c0b1] bg-[#eceae3]/50 p-4">
              <div className="flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-[#ff4f00]" />
                <h2 className="text-[18px] font-bold text-[#201515]">
                  Ringkasan Cart
                </h2>
              </div>
              <p className="mt-1 text-[13px] text-[#939084]">
                Total dihitung dari harga SKU saat ini.
              </p>
            </div>

            <div className="space-y-4 p-4">
              <SummaryRow label="Jumlah item" value={`${lines.length} SKU`} />
              <SummaryRow label="Total qty" value={`${totals.quantity}`} />
              <div className="border-t border-[#c5c0b1] pt-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
                  Grand total
                </p>
                <p className="mt-1 text-[32px] font-bold leading-none text-[#201515]">
                  {formatCurrency(totals.amount)}
                </p>
              </div>

              {hasOverStock && (
                <div className="flex gap-2 rounded-[5px] border border-[#ff4f00] bg-[#fffefb] p-3 text-[13px] font-semibold text-[#ff4f00]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  Ada item yang jumlahnya melebihi stok tersedia.
                </div>
              )}

              <div>
                <label className="mb-2 block text-[14px] font-bold text-[#201515]">
                  Catatan transaksi
                </label>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="min-h-24 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 py-3 text-[15px] text-[#201515] outline-none placeholder:text-[#939084] focus:border-[#ff4f00]"
                  placeholder="Contoh: penjualan kasir sore"
                />
              </div>
            </div>

            <div className="sticky bottom-16 border-t border-[#c5c0b1] bg-[#fffefb] p-4 lg:static">
              <button
                type="submit"
                disabled={
                  loading ||
                  lines.length === 0 ||
                  hasInvalidQuantity ||
                  hasOverStock
                }
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[8px] border border-[#ff4f00] bg-[#ff4f00] px-5 text-[16px] font-bold text-[#fffefb] transition-colors hover:bg-[#e64600] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="h-5 w-5 rounded-full border-2 border-[#fffefb]/35 border-t-[#fffefb] animate-spin" />
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    Selesaikan Transaksi
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={clearCart}
                disabled={lines.length === 0 || loading}
                className="mt-3 flex min-h-11 w-full items-center justify-center rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] text-[14px] font-bold text-[#36342e] hover:bg-[#eceae3] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Kosongkan Cart
              </button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}

function CartLine({
  index,
  line,
  onQuantityChange,
  onRemove,
}: {
  index: number;
  line: StockLine;
  onQuantityChange: (lineId: string, quantity: number | "") => void;
  onRemove: (lineId: string) => void;
}) {
  const quantity = line.quantity;
  const isQuantityNumber = typeof quantity === "number";
  const isOverStock = isQuantityNumber && quantity > line.variant.stock;
  const price = getPrice(line.variant);
  const subtotal = (isQuantityNumber ? quantity : 0) * price;
  const remaining =
    isQuantityNumber && !isOverStock
      ? line.variant.stock - quantity
      : line.variant.stock;

  return (
    <article
      className={`grid gap-4 rounded-[8px] border bg-[#eceae3]/30 p-4 md:grid-cols-[minmax(0,1fr)_112px_112px_128px_44px] md:items-center ${
        isOverStock ? "border-[#ff4f00]" : "border-[#c5c0b1]"
      }`}
    >
      <div className="min-w-0">
        <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
          Item {index + 1}
        </p>
        <p className="mt-1 truncate text-[16px] font-bold text-[#201515]">
          {line.variant.productName}
        </p>
        <p className="truncate text-[13px] text-[#36342e]">
          {line.variant.sku}
        </p>
        {line.variant.variationString && (
          <p className="truncate text-[13px] text-[#939084]">
            {line.variant.variationString}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:block">
        <MiniMetric label="Harga" value={formatCurrency(price)} />
        <MiniMetric
          label="Sisa stok"
          value={`${remaining}`}
          warn={isOverStock || line.variant.stock <= line.variant.minStock}
        />
      </div>

      <div>
        <label className="mb-2 block text-[13px] font-bold text-[#201515] md:sr-only">
          Qty
        </label>
        <input
          type="number"
          min="1"
          inputMode="numeric"
          required
          value={line.quantity}
          onChange={(event) =>
            onQuantityChange(
              line.lineId,
              event.target.value === "" ? "" : Number(event.target.value)
            )
          }
          className={`min-h-12 w-full rounded-[5px] border bg-[#fffefb] px-3 text-[18px] font-semibold outline-none focus:border-[#ff4f00] ${
            isOverStock
              ? "border-[#ff4f00] text-[#ff4f00]"
              : "border-[#c5c0b1] text-[#201515]"
          }`}
          placeholder="Qty"
        />
        {isOverStock && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-[#ff4f00]">
            <AlertCircle className="h-3.5 w-3.5" />
            Melebihi stok
          </p>
        )}
      </div>

      <div className="rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
          Subtotal
        </p>
        <p className="mt-1 text-[15px] font-bold text-[#201515]">
          {formatCurrency(subtotal)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onRemove(line.lineId)}
        className="flex min-h-11 items-center justify-center rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] text-[#939084] hover:bg-[#eceae3] hover:text-[#ff4f00]"
        aria-label={`Hapus ${line.variant.sku}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </article>
  );
}

function MiniMetric({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] p-3 md:border-0 md:bg-transparent md:p-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
        {label}
      </p>
      <p
        className={`mt-1 text-[15px] font-bold ${
          warn ? "text-[#ff4f00]" : "text-[#201515]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[14px]">
      <span className="font-semibold text-[#939084]">{label}</span>
      <span className="font-bold text-[#201515]">{value}</span>
    </div>
  );
}
