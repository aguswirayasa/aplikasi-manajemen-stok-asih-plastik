"use client";

import { AlertCircle } from "lucide-react";
import {
  StockLineSummary,
  StockMetric,
  StockQuantityInput,
  StockRemoveButton,
} from "@/components/stock/StockLineParts";
import {
  formatStockCurrency,
  getStockVariantPrice,
} from "@/lib/stock-format";
import type { StockLine } from "@/types/stock";

export function StockOutCartLine({
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
  const price = getStockVariantPrice(line.variant);
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
      <StockLineSummary
        index={index}
        primary={line.variant.productName}
        secondary={line.variant.sku}
        variationString={line.variant.variationString}
      />

      <div className="grid grid-cols-2 gap-3 md:block">
        <StockMetric label="Harga" value={formatStockCurrency(price)} />
        <StockMetric
          label="Sisa stok"
          value={`${remaining}`}
          warn={isOverStock || line.variant.stock <= line.variant.minStock}
        />
      </div>

      <StockQuantityInput
        label="Qty"
        value={line.quantity}
        invalid={isOverStock}
        onChange={(quantity) => onQuantityChange(line.lineId, quantity)}
        errorMessage={
          isOverStock ? (
            <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-[#ff4f00]">
              <AlertCircle className="h-3.5 w-3.5" />
              Melebihi stok
            </p>
          ) : null
        }
      />

      <div className="rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
          Subtotal
        </p>
        <p className="mt-1 text-[15px] font-bold text-[#201515]">
          {formatStockCurrency(subtotal)}
        </p>
      </div>

      <StockRemoveButton
        sku={line.variant.sku}
        onRemove={() => onRemove(line.lineId)}
      />
    </article>
  );
}
