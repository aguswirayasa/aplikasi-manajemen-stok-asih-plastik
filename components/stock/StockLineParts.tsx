"use client";

import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";

export function StockLineSummary({
  index,
  primary,
  secondary,
  variationString,
}: {
  index: number;
  primary: string;
  secondary: string;
  variationString?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
        Item {index + 1}
      </p>
      <p className="mt-1 truncate text-[16px] font-bold text-[#201515]">
        {primary}
      </p>
      <p className="truncate text-[13px] text-[#36342e]">{secondary}</p>
      {variationString && (
        <p className="truncate text-[13px] text-[#939084]">{variationString}</p>
      )}
    </div>
  );
}

export function StockMetric({
  label,
  value,
  warn,
  prominent,
}: {
  label: string;
  value: string;
  warn?: boolean;
  prominent?: boolean;
}) {
  return (
    <div className="rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] p-3 md:border-0 md:bg-transparent md:p-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
        {label}
      </p>
      <p
        className={`mt-1 font-bold ${
          prominent ? "text-[24px] leading-none" : "text-[15px]"
        } ${warn ? "text-[#ff4f00]" : "text-[#201515]"}`}
      >
        {value}
      </p>
    </div>
  );
}

export function StockQuantityInput({
  label,
  value,
  onChange,
  invalid,
  errorMessage,
}: {
  label: string;
  value: number | "";
  onChange: (quantity: number | "") => void;
  invalid?: boolean;
  errorMessage?: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-[13px] font-bold text-[#201515] md:sr-only">
        {label}
      </label>
      <input
        type="number"
        min="1"
        inputMode="numeric"
        required
        value={value}
        onChange={(event) =>
          onChange(event.target.value === "" ? "" : Number(event.target.value))
        }
        className={`min-h-12 w-full rounded-[5px] border bg-[#fffefb] px-3 text-[18px] font-semibold outline-none focus:border-[#ff4f00] ${
          invalid
            ? "border-[#ff4f00] text-[#ff4f00]"
            : "border-[#c5c0b1] text-[#201515]"
        }`}
        placeholder="Qty"
      />
      {errorMessage}
    </div>
  );
}

export function StockRemoveButton({
  sku,
  onRemove,
}: {
  sku: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="flex min-h-11 items-center justify-center rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] text-[#939084] hover:bg-[#eceae3] hover:text-[#ff4f00]"
      aria-label={`Hapus ${sku}`}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

export function StockSummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-[14px]">
      <span className="font-semibold text-[#939084]">{label}</span>
      <span className="font-bold text-[#201515]">{value}</span>
    </div>
  );
}
