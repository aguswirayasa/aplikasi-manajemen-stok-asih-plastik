"use client";

import { AlertCircle, ReceiptText, Save } from "lucide-react";
import { formatStockCurrency } from "@/lib/stock-format";
import { StockSummaryRow } from "@/components/stock/StockLineParts";

export function StockOutSummary({
  lineCount,
  totalQuantity,
  totalAmount,
  hasOverStock,
  loading,
  submitDisabled,
  onClearCart,
}: {
  lineCount: number;
  totalQuantity: number;
  totalAmount: number;
  hasOverStock: boolean;
  loading: boolean;
  submitDisabled: boolean;
  onClearCart: () => void;
}) {
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

          {hasOverStock && (
            <div className="flex gap-2 rounded-[5px] border border-[#ff4f00] bg-[#fffefb] p-3 text-[13px] font-semibold text-[#ff4f00]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Ada item yang jumlahnya melebihi stok tersedia.
            </div>
          )}
        </div>

        <div className="sticky bottom-16 border-t border-[#c5c0b1] bg-[#fffefb] p-4 lg:static">
          <button
            type="submit"
            disabled={submitDisabled}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[8px] border border-[#ff4f00] bg-[#ff4f00] px-5 text-[16px] font-bold text-[#fffefb] transition-colors hover:bg-[#e64600] disabled:cursor-not-allowed disabled:opacity-50"
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
            className="mt-3 flex min-h-11 w-full items-center justify-center rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] text-[14px] font-bold text-[#36342e] hover:bg-[#eceae3] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Kosongkan Cart
          </button>
        </div>
      </div>
    </aside>
  );
}
