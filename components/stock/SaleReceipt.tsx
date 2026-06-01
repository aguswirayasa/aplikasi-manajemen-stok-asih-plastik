"use client";

import { forwardRef } from "react";
import { formatStockCurrency } from "@/lib/stock-format";
import type { SaleReceiptData, SaleReceiptItem } from "@/types/sales";

const receiptDateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Singapore",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatVariation(item: SaleReceiptItem) {
  return (
    item.variant.values
      .map((value) => value.variationValue.value)
      .filter(Boolean)
      .join(" / ") || "-"
  );
}

function money(value: number | string | { toString(): string }) {
  return formatStockCurrency(Number(value));
}

export const SaleReceipt = forwardRef<HTMLDivElement, { sale: SaleReceiptData }>(
  function SaleReceipt({ sale }, ref) {
    return (
      <div
        ref={ref}
        className="sale-receipt bg-white p-5 text-[#201515] print:p-0"
      >
        {/* Header — branding toko */}
        <div className="text-center mb-3">
          <p className="text-[18px] font-bold uppercase tracking-wide">ASIH PLASTIK</p>
          <p className="text-[13px] text-[#555]">Struk Penjualan</p>
        </div>

        {/* Meta — informasi transaksi */}
        <div className="mt-4 space-y-1 border-y border-dashed border-[#939084] py-3 text-[14px]">
          <div className="flex justify-between gap-4">
            <span className="text-[#555]">No. struk</span>
            <span>{sale.receiptNumber}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#555]">Waktu</span>
            <span>{receiptDateFormatter.format(new Date(sale.createdAt))}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#555]">Kasir</span>
            <span>{sale.cashier.name || sale.cashier.username}</span>
          </div>
        </div>

        {/* Daftar item — format 3 baris per item */}
        <div className="mt-4">
          {sale.items.map((item, index) => (
            <div
              key={item.id}
              className={`py-2 ${index < sale.items.length - 1 ? "border-b border-dotted border-gray-300" : ""}`}
            >
              <p className="text-[14px] font-semibold">{item.variant.product.name}</p>
              <p className="text-[13px] text-[#555] pl-2">{formatVariation(item)}</p>
              <div className="flex justify-between text-[13px] pl-2">
                <span>{item.quantity} x {money(item.unitPrice)}</span>
                <span className="tabular-nums">{money(item.subtotal)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Ringkasan — total, bayar, kembali */}
        <div className="mt-4 border-t border-[#201515] pt-3 pb-2">
          <div className="space-y-1 pb-2 border-b border-dashed border-[#939084]">
            <div className="flex justify-between gap-4 text-[16px] font-bold uppercase">
              <span>Total</span>
              <span className="tabular-nums">{money(sale.totalAmount)}</span>
            </div>
            <div className="flex justify-between gap-4 text-[14px]">
              <span>Bayar</span>
              <span className="tabular-nums">{money(sale.paidAmount)}</span>
            </div>
            <div className="flex justify-between gap-4 text-[14px] font-bold">
              <span>Kembali</span>
              <span className="tabular-nums">{money(sale.changeAmount)}</span>
            </div>
          </div>
        </div>

        {/* Footer — pesan terima kasih */}
        <p className="mt-3 text-center text-[12px] text-[#555]">
          Terima kasih atas kunjungan Anda!
        </p>
      </div>
    );
  }
);

