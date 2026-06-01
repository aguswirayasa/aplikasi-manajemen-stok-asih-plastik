import type { StockVariantOption } from "@/components/stock/VariantSelect";

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function getStockVariantPrice(variant: StockVariantOption) {
  const price =
    typeof variant.price === "number" ? variant.price : Number(variant.price);

  return Number.isFinite(price) ? price : 0;
}

export function formatStockCurrency(value: number) {
  return currencyFormatter.format(value);
}

// Format ringkas: nilai >= 10 juta ditampilkan sebagai "Rp X Juta", "Rp X,X Juta", dst.
export function formatStockCurrencyCompact(value: number): string {
  if (value >= 1_000_000_000) {
    const miliar = value / 1_000_000_000;
    const formatted = miliar % 1 === 0 ? `${miliar}` : miliar.toFixed(1).replace(".", ",");
    return `Rp ${formatted} M`;
  }
  if (value >= 10_000_000) {
    const juta = value / 1_000_000;
    const formatted = juta % 1 === 0 ? `${juta}` : juta.toFixed(1).replace(".", ",");
    return `Rp ${formatted} Juta`;
  }
  return currencyFormatter.format(value);
}
