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
