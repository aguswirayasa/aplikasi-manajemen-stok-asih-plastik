"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { PackagePlus, Save, Trash2 } from "lucide-react";
import {
  StockVariantOption,
  VariantSelect,
} from "@/components/stock/VariantSelect";

type StockLine = {
  lineId: string;
  variant: StockVariantOption;
  quantity: number | "";
};

function newLine(variant: StockVariantOption): StockLine {
  return {
    lineId: `${variant.id}-${crypto.randomUUID()}`,
    variant,
    quantity: "",
  };
}

export default function StockInPage() {
  const router = useRouter();
  const [lines, setLines] = useState<StockLine[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const hasInvalidQuantity = lines.some(
    (line) => typeof line.quantity !== "number" || line.quantity <= 0
  );
  const totalQuantity = useMemo(
    () =>
      lines.reduce(
        (total, line) =>
          total + (typeof line.quantity === "number" ? line.quantity : 0),
        0
      ),
    [lines]
  );

  const handleAddVariant = (variant: StockVariantOption) => {
    if (lines.some((line) => line.variant.id === variant.id)) {
      toast.error("SKU sudah ada di daftar.");
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (lines.length === 0) {
      toast.error("Tambahkan minimal satu SKU.");
      return;
    }

    if (hasInvalidQuantity) {
      toast.error("Setiap SKU harus punya jumlah masuk yang valid.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/stock/in", {
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
        throw new Error(data.error || "Gagal mencatat stok masuk.");
      }

      toast.success(data.message || "Stok masuk berhasil dicatat.");
      router.push("/stock/history");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal mencatat stok masuk."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[860px] space-y-6 pb-8">
      <header className="flex items-start gap-3">
        <PackagePlus className="mt-1 h-7 w-7 text-[#ff4f00]" />
        <div>
          <h1 className="text-[28px] font-semibold leading-[1] text-[#201515]">
            Barang Masuk
          </h1>
          <p className="mt-1 text-[15px] leading-[1.25] text-[#939084]">
            Tambahkan beberapa SKU dalam satu catatan stok masuk.
          </p>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]"
      >
        <div className="space-y-6 p-4 sm:p-6">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block text-[14px] font-bold text-[#201515]">
                Cari dan tambah SKU
              </label>
              <span className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
                {lines.length} SKU
              </span>
            </div>
            <VariantSelect onSelect={handleAddVariant} />
          </div>

          <section className="space-y-3">
            {lines.length === 0 ? (
              <div className="rounded-[8px] border border-dashed border-[#c5c0b1] bg-[#fffefb] p-6 text-center">
                <p className="text-[15px] font-semibold text-[#201515]">
                  Belum ada SKU
                </p>
                <p className="mt-1 text-[13px] text-[#939084]">
                  Cari SKU di atas, lalu pilih untuk menambahkannya ke daftar.
                </p>
              </div>
            ) : (
              lines.map((line, index) => (
                <article
                  key={line.lineId}
                  className="grid gap-4 rounded-[8px] border border-[#c5c0b1] bg-[#eceae3]/30 p-4 md:grid-cols-[minmax(0,1fr)_130px_130px_44px] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
                      Item {index + 1}
                    </p>
                    <p className="mt-1 truncate text-[16px] font-bold text-[#201515]">
                      {line.variant.sku}
                    </p>
                    <p className="truncate text-[13px] text-[#36342e]">
                      {line.variant.productName}
                    </p>
                    {line.variant.variationString && (
                      <p className="truncate text-[13px] text-[#939084]">
                        {line.variant.variationString}
                      </p>
                    )}
                  </div>

                  <div className="rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
                      Stok saat ini
                    </p>
                    <p className="mt-1 text-[24px] font-bold leading-none text-[#201515]">
                      {line.variant.stock}
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-[13px] font-bold text-[#201515] md:sr-only">
                      Jumlah masuk
                    </label>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      required
                      value={line.quantity}
                      onChange={(event) =>
                        updateQuantity(
                          line.lineId,
                          event.target.value === ""
                            ? ""
                            : Number(event.target.value)
                        )
                      }
                      className="min-h-12 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[18px] font-semibold text-[#201515] outline-none focus:border-[#ff4f00]"
                      placeholder="Qty"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeLine(line.lineId)}
                    className="flex min-h-11 items-center justify-center rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] text-[#939084] hover:bg-[#eceae3] hover:text-[#ff4f00]"
                    aria-label={`Hapus ${line.variant.sku}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </article>
              ))
            )}
          </section>

          <div>
            <label className="mb-2 block text-[14px] font-bold text-[#201515]">
              Catatan
            </label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-24 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 py-3 text-[15px] text-[#201515] outline-none placeholder:text-[#939084] focus:border-[#ff4f00]"
              placeholder="Contoh: kiriman supplier pagi"
            />
          </div>
        </div>

        <div className="sticky bottom-16 border-t border-[#c5c0b1] bg-[#fffefb] p-4 sm:static sm:p-6">
          <div className="mb-3 flex items-center justify-between text-[13px] font-semibold text-[#36342e]">
            <span>Total SKU: {lines.length}</span>
            <span>Total qty: {totalQuantity}</span>
          </div>
          <button
            type="submit"
            disabled={loading || lines.length === 0 || hasInvalidQuantity}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[8px] border border-[#ff4f00] bg-[#ff4f00] px-5 text-[15px] font-bold text-[#fffefb] transition-colors hover:bg-[#e64600] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="h-5 w-5 rounded-full border-2 border-[#fffefb]/35 border-t-[#fffefb] animate-spin" />
            ) : (
              <>
                <Save className="h-5 w-5" />
                Simpan Barang Masuk
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
