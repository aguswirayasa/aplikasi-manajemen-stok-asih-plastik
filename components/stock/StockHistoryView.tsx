"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  History,
  PackageOpen,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  buildStockHistoryQuery,
  getStockHistoryPeriodLabel,
  getStockHistoryTypeLabel,
  type StockHistoryResult,
} from "@/lib/stock-history-utils";
import { formatStockCurrency } from "@/lib/stock-format";
import type { StockTransactionGroup } from "@/lib/stock-transactions";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Singapore",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(date: Date) {
  return dateFormatter.format(date);
}

// Ringkasan produk untuk grup yang tampil saat baris belum diperluas
function summarizeProducts(group: StockTransactionGroup) {
  const first = group.lines[0];

  if (!first) {
    return "-";
  }

  const remaining = group.lineCount - 1;

  return remaining > 0
    ? `${first.productName} +${remaining} lainnya`
    : first.productName;
}

export function StockHistoryView({ result }: { result: StockHistoryResult }) {
  const { filter, history, pagination } = result;
  const reportHref = `/stock/history/report${buildStockHistoryQuery(filter)}`;

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <History className="mt-1 h-7 w-7 text-[#ff4f00]" />
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
              Audit stok
            </p>
            <h1 className="text-[28px] font-semibold leading-[1] text-[#201515]">
              Riwayat Transaksi
            </h1>
            <p className="mt-1 max-w-[620px] text-[15px] leading-[1.25] text-[#939084]">
              Filter barang masuk dan transaksi kasir, lalu unduh laporan dari
              hasil yang sedang dipilih.
            </p>
          </div>
        </div>
        <Link
          href={reportHref}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-[#ff4f00] bg-[#ff4f00] px-4 text-[13px] font-bold text-[#fffefb] hover:bg-[#e64600]"
        >
          <Download className="h-4 w-4" />
          Download Laporan
        </Link>
      </header>

      <section className="rounded-[8px] border border-[#c5c0b1] bg-[#fffefb] p-4">
        <div className="flex items-start gap-3">
          <Filter className="mt-1 h-5 w-5 text-[#ff4f00]" />
          <div>
            <h2 className="text-[16px] font-bold text-[#201515]">
              Filter riwayat
            </h2>
            <p className="text-[13px] text-[#939084]">
              Periode aktif: {getStockHistoryPeriodLabel(filter)}
            </p>
          </div>
        </div>

        <form className="mt-4 grid gap-3 lg:grid-cols-[180px_160px_160px_auto_auto] lg:items-end">
          <label className="space-y-1.5">
            <span className="text-[12px] font-bold text-[#36342e]">Tipe</span>
            <select
              name="type"
              defaultValue={filter.type}
              className="min-h-10 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[13px] font-semibold text-[#201515]"
            >
              <option value="all">Semua</option>
              <option value="in">Barang Masuk</option>
              <option value="sales">Transaksi</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[12px] font-bold text-[#36342e]">
              Tanggal awal
            </span>
            <input
              type="date"
              name="from"
              defaultValue={filter.fromInput}
              className="min-h-10 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[13px] font-semibold text-[#201515]"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[12px] font-bold text-[#36342e]">
              Tanggal akhir
            </span>
            <input
              type="date"
              name="to"
              defaultValue={filter.toInput}
              className="min-h-10 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[13px] font-semibold text-[#201515]"
            />
          </label>
          <button
            type="submit"
            className="min-h-10 rounded-[5px] border border-[#ff4f00] bg-[#ff4f00] px-4 text-[13px] font-bold text-[#fffefb] hover:bg-[#e64600]"
          >
            Terapkan
          </button>
          <Link
            href="/stock/history"
            className="inline-flex min-h-10 items-center justify-center rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-4 text-[13px] font-bold text-[#201515] hover:bg-[#eceae3]"
          >
            Reset
          </Link>
        </form>
      </section>

      <section className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]">
        <div className="flex flex-col gap-2 border-b border-[#c5c0b1] bg-[#eceae3]/35 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-bold text-[#201515]">
              {getStockHistoryTypeLabel(filter.type)}
            </p>
            <p className="text-[12px] text-[#939084]">
              Menampilkan {history.length} dari {pagination.totalItems} transaksi
            </p>
          </div>
          <div className="rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 py-2 text-[13px] font-semibold text-[#36342e]">
            Halaman {pagination.page} / {pagination.totalPages}
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#c5c0b1] bg-[#eceae3]/50">
                <th className="w-10 p-4" />
                <th className="p-4 text-[13px] font-bold text-[#201515]">
                  Tipe
                </th>
                <th className="p-4 text-[13px] font-bold text-[#201515]">
                  Waktu
                </th>
                <th className="p-4 text-[13px] font-bold text-[#201515]">
                  Produk
                </th>
                <th className="p-4 text-right text-[13px] font-bold text-[#201515]">
                  Qty
                </th>
                <th className="p-4 text-[13px] font-bold text-[#201515]">
                  User
                </th>
                <th className="p-4 text-[13px] font-bold text-[#201515]">
                  Catatan
                </th>
                <th className="p-4 text-[13px] font-bold text-[#201515]">
                  Penjualan
                </th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10">
                    <EmptyHistory />
                  </td>
                </tr>
              ) : (
                history.map((group) => (
                  <DesktopGroupRow key={group.key} group={group} />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-[#eceae3] md:hidden">
          {history.length === 0 ? (
            <div className="p-8">
              <EmptyHistory />
            </div>
          ) : (
            history.map((group) => (
              <MobileGroupCard key={group.key} group={group} />
            ))
          )}
        </div>

        <Pagination result={result} />
      </section>
    </div>
  );
}

function DesktopGroupRow({ group }: { group: StockTransactionGroup }) {
  const [expanded, setExpanded] = useState(false);
  const isMulti = group.lineCount > 1;
  const first = group.lines[0];

  return (
    <>
      <tr
        className={`border-b border-[#eceae3] hover:bg-[#eceae3]/25 ${
          expanded ? "bg-[#eceae3]/20" : ""
        }`}
      >
        <td className="p-4 align-top">
          {isMulti ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              aria-label={expanded ? "Sembunyikan detail" : "Lihat detail"}
              className="flex h-7 w-7 items-center justify-center rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] text-[#201515] hover:bg-[#eceae3]"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </button>
          ) : null}
        </td>
        <td className="p-4 align-top">
          <TransactionType type={group.type} />
        </td>
        <td className="p-4 align-top text-[14px] text-[#36342e]">
          {formatDate(group.createdAt)}
        </td>
        <td className="p-4 align-top">
          {isMulti ? (
            <>
              <p className="text-[14px] font-semibold text-[#201515]">
                {summarizeProducts(group)}
              </p>
              <p className="text-[12px] text-[#939084]">
                {group.lineCount} SKU
              </p>
            </>
          ) : (
            <>
              <p className="text-[14px] font-semibold text-[#201515]">
                {first?.productName}
              </p>
              <p className="text-[12px] text-[#939084]">
                {first?.sku} · {first?.variationLabel}
              </p>
            </>
          )}
        </td>
        <td className="p-4 align-top text-right">
          <span className="font-bold text-[#201515]">
            {group.type === "IN" ? "+" : "-"}
            {group.totalQuantity}
          </span>
        </td>
        <td className="p-4 align-top text-[14px] text-[#36342e]">
          {group.user.name || group.user.username}
        </td>
        <td className="max-w-[260px] p-4 align-top text-[14px] text-[#939084]">
          <span className="line-clamp-2">{group.note || "-"}</span>
        </td>
        <td className="p-4 align-top text-[14px]">
          <SaleLink group={group} />
        </td>
      </tr>
      {expanded && isMulti
        ? group.lines.map((line) => (
            <tr key={line.id} className="border-b border-[#eceae3] bg-[#faf9f5]">
              <td className="p-0" />
              <td className="p-0" />
              <td className="py-2.5 pl-4 pr-4 align-top" colSpan={2}>
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c5c0b1]" />
                  <div>
                    <p className="text-[13px] font-semibold text-[#201515]">
                      {line.productName}
                    </p>
                    <p className="text-[12px] text-[#939084]">
                      {line.sku} · {line.variationLabel}
                    </p>
                  </div>
                </div>
              </td>
              <td className="py-2.5 pr-4 align-top text-right text-[13px] font-semibold text-[#36342e]">
                {group.type === "IN" ? "+" : "-"}
                {line.quantity}
              </td>
              <td className="p-0" colSpan={3} />
            </tr>
          ))
        : null}
    </>
  );
}

function MobileGroupCard({ group }: { group: StockTransactionGroup }) {
  const [expanded, setExpanded] = useState(false);
  const isMulti = group.lineCount > 1;
  const first = group.lines[0];

  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <TransactionIcon type={group.type} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <TransactionType type={group.type} />
              {isMulti ? (
                <span className="inline-flex min-h-6 items-center rounded-[20px] border border-[#c5c0b1] bg-[#eceae3]/40 px-2 text-[11px] font-bold text-[#36342e]">
                  {group.lineCount} SKU
                </span>
              ) : null}
            </div>
            {isMulti ? (
              <p className="mt-1 text-[13px] font-semibold text-[#36342e]">
                {summarizeProducts(group)}
              </p>
            ) : (
              <>
                <p className="mt-1 text-[13px] font-semibold text-[#36342e]">
                  {first?.productName}
                </p>
                <p className="text-[12px] text-[#939084]">
                  {first?.sku} · {first?.variationLabel}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[20px] font-bold leading-none text-[#201515]">
            {group.type === "IN" ? "+" : "-"}
            {group.totalQuantity}
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
            Qty
          </p>
        </div>
      </div>

      {isMulti ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[12px] font-bold text-[#201515] hover:bg-[#eceae3]"
          >
            {expanded ? "Sembunyikan rincian" : `Lihat ${group.lineCount} SKU`}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </button>
          {expanded ? (
            <ul className="mt-3 divide-y divide-[#eceae3] rounded-[5px] border border-[#c5c0b1] bg-[#faf9f5]">
              {group.lines.map((line) => (
                <li
                  key={line.id}
                  className="flex items-start justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#201515]">
                      {line.productName}
                    </p>
                    <p className="text-[12px] text-[#939084]">
                      {line.sku} · {line.variationLabel}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] font-bold text-[#36342e]">
                    {group.type === "IN" ? "+" : "-"}
                    {line.quantity}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
        <div className="rounded-[5px] border border-[#c5c0b1] bg-[#eceae3]/30 p-3">
          <p className="font-semibold uppercase tracking-[0.5px] text-[#939084]">
            Waktu
          </p>
          <p className="mt-1 text-[#36342e]">{formatDate(group.createdAt)}</p>
        </div>
        <div className="rounded-[5px] border border-[#c5c0b1] bg-[#eceae3]/30 p-3">
          <p className="font-semibold uppercase tracking-[0.5px] text-[#939084]">
            User
          </p>
          <p className="mt-1 text-[#36342e]">
            {group.user.name || group.user.username}
          </p>
        </div>
      </div>

      {group.note ? (
        <p className="mt-3 rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] p-3 text-[13px] text-[#36342e]">
          {group.note}
        </p>
      ) : null}
      <div className="mt-3">
        <SaleLink group={group} />
      </div>
    </article>
  );
}

function Pagination({ result }: { result: StockHistoryResult }) {
  const { filter, pagination } = result;
  const previousHref = `/stock/history${buildStockHistoryQuery(filter, {
    includePage: true,
    page: pagination.page - 1,
  })}`;
  const nextHref = `/stock/history${buildStockHistoryQuery(filter, {
    includePage: true,
    page: pagination.page + 1,
  })}`;

  return (
    <div className="flex flex-col gap-3 border-t border-[#c5c0b1] p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-center text-[13px] font-semibold text-[#36342e] sm:text-left">
        Halaman {pagination.page} dari {pagination.totalPages}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        {pagination.hasPreviousPage ? (
          <Link
            href={previousHref}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-4 text-[13px] font-bold text-[#201515] hover:bg-[#eceae3]"
          >
            <ChevronLeft className="h-4 w-4" />
            Sebelumnya
          </Link>
        ) : (
          <span className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-[#eceae3] bg-[#eceae3]/30 px-4 text-[13px] font-bold text-[#939084]">
            <ChevronLeft className="h-4 w-4" />
            Sebelumnya
          </span>
        )}
        {pagination.hasNextPage ? (
          <Link
            href={nextHref}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-4 text-[13px] font-bold text-[#201515] hover:bg-[#eceae3]"
          >
            Berikutnya
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-[#eceae3] bg-[#eceae3]/30 px-4 text-[13px] font-bold text-[#939084]">
            Berikutnya
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}

function SaleLink({ group }: { group: StockTransactionGroup }) {
  if (group.type !== "OUT" || !group.sale) {
    return <span className="text-[#939084]">-</span>;
  }

  return (
    <Link
      href={`/sales/${group.sale.id}`}
      className="inline-flex min-h-8 items-center rounded-[20px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[12px] font-bold text-[#201515] hover:bg-[#eceae3]"
    >
      {group.sale.receiptNumber} - {formatStockCurrency(group.sale.totalAmount)}
    </Link>
  );
}

function TransactionType({ type }: { type: "IN" | "OUT" }) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-[20px] border border-[#c5c0b1] bg-[#fffefb] px-2.5 text-[12px] font-bold text-[#201515]">
      {type === "IN" ? (
        <ArrowDownLeft className="h-3.5 w-3.5 text-[#ff4f00]" />
      ) : (
        <ArrowUpRight className="h-3.5 w-3.5 text-[#ff4f00]" />
      )}
      {type === "IN" ? "Masuk" : "Keluar"}
    </span>
  );
}

function TransactionIcon({ type }: { type: "IN" | "OUT" }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] text-[#ff4f00]">
      {type === "IN" ? (
        <ArrowDownLeft className="h-4 w-4" />
      ) : (
        <ArrowUpRight className="h-4 w-4" />
      )}
    </span>
  );
}

function EmptyHistory() {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <PackageOpen className="mb-3 h-9 w-9 text-[#c5c0b1]" />
      <h2 className="text-[16px] font-bold text-[#201515]">
        Tidak ada data riwayat
      </h2>
      <p className="mt-1 max-w-[320px] text-[14px] text-[#939084]">
        Ubah filter atau tanggal untuk melihat data barang masuk dan transaksi.
      </p>
    </div>
  );
}
