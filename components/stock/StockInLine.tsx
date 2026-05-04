"use client";

import type { StockLine } from "@/types/stock";
import {
  StockLineSummary,
  StockMetric,
  StockQuantityInput,
  StockRemoveButton,
} from "@/components/stock/StockLineParts";

export function StockInLine({
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
  return (
    <article className="grid gap-4 rounded-[8px] border border-[#c5c0b1] bg-[#eceae3]/30 p-4 md:grid-cols-[minmax(0,1fr)_130px_130px_44px] md:items-center">
      <StockLineSummary
        index={index}
        primary={line.variant.sku}
        secondary={line.variant.productName}
        variationString={line.variant.variationString}
      />

      <StockMetric
        label="Stok saat ini"
        value={`${line.variant.stock}`}
        prominent
      />

      <StockQuantityInput
        label="Jumlah masuk"
        value={line.quantity}
        onChange={(quantity) => onQuantityChange(line.lineId, quantity)}
      />

      <StockRemoveButton
        sku={line.variant.sku}
        onRemove={() => onRemove(line.lineId)}
      />
    </article>
  );
}
