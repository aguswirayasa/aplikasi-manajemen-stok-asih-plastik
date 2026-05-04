import type { StockVariantOption } from "@/components/stock/VariantSelect";

export type StockLine = {
  lineId: string;
  variant: StockVariantOption;
  quantity: number | "";
};
