"use client";

import type { KeyboardEvent, Ref } from "react";
import { AlertCircle, ReceiptText, Save } from "lucide-react";
import { formatStockCurrency } from "@/lib/stock-format";
import { StockSummaryRow } from "@/components/stock/StockLineParts";
import { Input } from "@/components/ui/input";

export function StockOutSummary({
  lineCount,
  totalQuantity,
  totalAmount,
  paidAmount,
  changeAmount,
  hasOverStock,
  hasUnderpaid,
  loading,
  submitDisabled,
  onPaidAmountChange,
  onClearCart,
  paidAmountRef,
  onPaidAmountEnter,
}: {
  lineCount: number;
  totalQuantity: number;
  totalAmount: number;
  paidAmount: string;
  changeAmount: number;
  hasOverStock: boolean;
  hasUnderpaid: boolean;
  loading: boolean;
  submitDisabled: boolean;
  onPaidAmountChange: (value: string) => void;
  onClearCart: () => void;
  paidAmountRef?: Ref<HTMLInputElement>;
  onPaidAmountEnter?: () => void;
}) {
  const handlePaidAmountKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || !onPaidAmountEnter) {
      return;
    }

    event.preventDefault();
    onPaidAmountEnter();
  };

  return (
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
          <StockSummaryRow label="Jumlah item" value={`${lineCount} SKU`} />
          <StockSummaryRow label="Total qty" value={`${totalQuantity}`} />
          <div className="border-t border-[#c5c0b1] pt-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
              Grand total
            </p>
            <p className="mt-1 text-[32px] font-bold leading-none text-[#201515]">
              {formatStockCurrency(totalAmount)}
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="paidAmount"
              className="text-[13px] font-bold text-[#201515]"
            >
              Uang dibayar
            </label>
            <Input
              ref={paidAmountRef}
              id="paidAmount"
              type="number"
              min={0}
              inputMode="numeric"
              value={paidAmount}
              onChange={(event) => onPaidAmountChange(event.target.value)}
              onKeyDown={handlePaidAmountKeyDown}
              className="min-h-12 rounded-[5px] border-[#c5c0b1] bg-[#fffefb] text-[16px] font-semibold"
              placeholder="0"
            />
            <StockSummaryRow
              label="Kembalian"
              value={formatStockCurrency(Math.max(changeAmount, 0))}
            />
          </div>

          {hasOverStock && (
            <div className="flex gap-2 rounded-[5px] border border-[#ff4f00] bg-[#fffefb] p-3 text-[13px] font-semibold text-[#ff4f00]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Ada item yang jumlahnya melebihi stok tersedia.
            </div>
          )}
          {hasUnderpaid && (
            <div className="flex gap-2 rounded-[5px] border border-[#ff4f00] bg-[#fffefb] p-3 text-[13px] font-semibold text-[#ff4f00]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Uang dibayar kurang dari total transaksi.
            </div>
          )}
        </div>

        <div className="border-t border-[#c5c0b1] bg-[#fffefb] p-4">
          <button
            type="submit"
            disabled={submitDisabled}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[8px] border border-[#ff4f00] bg-[#ff4f00] px-5 text-[16px] font-bold text-[#fffefb] outline-none transition-colors hover:bg-[#e64600] focus-visible:border-[#201515] focus-visible:ring-3 focus-visible:ring-[#ff4f00]/35 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#fffefb]/35 border-t-[#fffefb]" />
            ) : (
              <>
                <Save className="h-5 w-5" />
                Selesaikan Transaksi
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClearCart}
            disabled={lineCount === 0 || loading}
            className="mt-3 flex min-h-11 w-full items-center justify-center rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] text-[14px] font-bold text-[#36342e] outline-none transition-shadow hover:bg-[#eceae3] focus-visible:border-[#ff4f00] focus-visible:ring-3 focus-visible:ring-[#ff4f00]/35 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Kosongkan Cart
          </button>
        </div>
      </div>
    </aside>
  );
}
