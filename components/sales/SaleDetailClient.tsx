"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { SaleReceipt } from "@/components/stock/SaleReceipt";
import { formatStockCurrency } from "@/lib/stock-format";
import type { SaleReceiptData } from "@/types/sales";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Singapore",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function SaleDetailClient({ sale }: { sale: SaleReceiptData }) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const printReceipt = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: sale.receiptNumber,
  });

  return (
    <div className="mx-auto max-w-[980px] space-y-5 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/stock/history"
            className="inline-flex items-center gap-2 text-[13px] font-bold text-[#ff4f00]"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke riwayat
          </Link>
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
            Detail penjualan
          </p>
          <h1 className="text-[28px] font-semibold leading-[1] text-[#201515]">
            {sale.receiptNumber}
          </h1>
        </div>
        <button
          type="button"
          onClick={printReceipt}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[5px] border border-[#ff4f00] bg-[#ff4f00] px-4 text-[14px] font-bold text-[#fffefb] hover:bg-[#e64600]"
        >
          <Printer className="h-4 w-4" />
          Cetak ulang struk
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <InfoCard label="Waktu" value={dateFormatter.format(new Date(sale.createdAt))} />
        <InfoCard label="Kasir" value={sale.cashier.name || sale.cashier.username} />
        <InfoCard label="Total" value={formatStockCurrency(Number(sale.totalAmount))} />
      </section>

      <section className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]">
        <div className="border-b border-[#c5c0b1] bg-[#eceae3]/35 p-4">
          <h2 className="text-[16px] font-bold text-[#201515]">
            Item transaksi
          </h2>
        </div>
        <div className="divide-y divide-[#eceae3]">
          {sale.items.map((item) => (
            <div
              key={item.id}
              className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_120px_140px_140px] md:items-center"
            >
              <div>
                <p className="font-bold text-[#201515]">
                  {item.variant.product.name}
                </p>
                <p className="text-[13px] text-[#939084]">
                  {item.variant.sku}
                </p>
              </div>
              <Metric label="Qty" value={`${item.quantity}`} />
              <Metric
                label="Harga"
                value={formatStockCurrency(Number(item.unitPrice))}
              />
              <Metric
                label="Subtotal"
                value={formatStockCurrency(Number(item.subtotal))}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <InfoCard label="Total" value={formatStockCurrency(Number(sale.totalAmount))} />
        <InfoCard label="Bayar" value={formatStockCurrency(Number(sale.paidAmount))} />
        <InfoCard label="Kembali" value={formatStockCurrency(Number(sale.changeAmount))} />
      </section>

      <div className="fixed -left-[10000px] top-0">
        <SaleReceipt ref={receiptRef} sale={sale} />
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#c5c0b1] bg-[#fffefb] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
        {label}
      </p>
      <p className="mt-1 text-[18px] font-bold text-[#201515]">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
        {label}
      </p>
      <p className="mt-1 font-bold text-[#201515]">{value}</p>
    </div>
  );
}
