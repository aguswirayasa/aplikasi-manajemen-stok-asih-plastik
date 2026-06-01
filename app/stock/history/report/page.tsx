import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { StockHistoryReportActions } from "@/components/stock/StockHistoryReportActions";
import { requirePageAuth } from "@/lib/page-auth";
import {
  buildStockHistoryQuery,
  getStockHistory,
  getStockHistoryPeriodLabel,
  getStockHistoryTypeLabel,
  parseStockHistoryFilter,
  STOCK_HISTORY_REPORT_LIMIT,
} from "@/lib/stock-history";
import { formatStockCurrency } from "@/lib/stock-format";
import type { StockTransactionGroup } from "@/lib/stock-transactions";

export const dynamic = "force-dynamic";

const reportDateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Singapore",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function StockHistoryReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAuth();

  const filter = parseStockHistoryFilter(await searchParams, {
    mode: "report",
  });
  const result = await getStockHistory(filter, { mode: "report" });
  const backHref = `/stock/history${buildStockHistoryQuery(filter)}`;
  const topSku = result.summary.topSku
    ? `${result.summary.topSku.sku} (${result.summary.topSku.quantity}) - ${result.summary.topSku.productName}`
    : "-";

  return (
    <div className="stock-history-report-screen">
      <div className="stock-history-report-toolbar print:hidden">
        <div className="flex flex-col gap-3 rounded-[8px] border border-[#c5c0b1] bg-[#fffefb] p-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={backHref}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-4 text-[13px] font-bold text-[#201515] hover:bg-[#eceae3]"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke riwayat
          </Link>
          <StockHistoryReportActions />
        </div>
      </div>

      <article className="stock-history-report">
        <header className="stock-history-report-header">
          <div className="stock-history-report-title-row">
            <FileText className="mt-1 h-7 w-7 text-[#ff4f00] print:hidden" />
            <div>
              <p className="stock-history-report-company">
                Asih Plastik
              </p>
              <h1 className="stock-history-report-title">
                Laporan Riwayat Stok
              </h1>
              <p className="stock-history-report-generated">
                Dibuat {reportDateFormatter.format(new Date())}
              </p>
            </div>
          </div>

          <div className="stock-history-report-meta-grid">
            <ReportInfo label="Tipe" value={getStockHistoryTypeLabel(filter.type)} />
            <ReportInfo
              label="Periode"
              value={getStockHistoryPeriodLabel(filter)}
            />
            <ReportInfo
              label="Data laporan"
              value={`${result.history.length} dari ${result.summary.totalRows} transaksi`}
            />
          </div>

          {result.summary.totalRows > STOCK_HISTORY_REPORT_LIMIT && (
            <p className="stock-history-report-limit-note">
              Laporan menampilkan {STOCK_HISTORY_REPORT_LIMIT} transaksi terbaru
              dari filter ini. Persempit tanggal untuk melihat data lebih rinci.
            </p>
          )}
        </header>

        <section className="stock-history-report-section">
          <h2 className="stock-history-report-section-title">
            Ringkasan
          </h2>
          <table className="stock-history-summary-table">
            <tbody>
              <tr>
                <th>Total data</th>
                <td>{result.summary.totalRows}</td>
                <th>Qty barang masuk</th>
                <td>{result.summary.totalStockInQuantity}</td>
              </tr>
              <tr>
                <th>Qty transaksi</th>
                <td>{result.summary.totalSalesQuantity}</td>
                <th>Omzet transaksi</th>
                <td>{formatStockCurrency(result.summary.salesRevenue)}</td>
              </tr>
              <tr>
                <th>SKU terlibat</th>
                <td>{result.summary.uniqueSkuCount}</td>
                <th>SKU paling aktif</th>
                <td>{topSku}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="stock-history-report-section">
          <h2 className="stock-history-report-section-title">
            Detail riwayat
          </h2>
          <div className="stock-history-detail-table-wrap">
            <table className="stock-history-detail-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Tipe</th>
                  <th>Waktu</th>
                  <th>SKU</th>
                  <th>Produk / Varian</th>
                  <th className="stock-history-report-number">Qty</th>
                  <th>User</th>
                  <th>Catatan</th>
                  <th>Penjualan</th>
                </tr>
              </thead>
              <tbody>
                {result.history.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="stock-history-report-empty"
                    >
                      Tidak ada data untuk filter ini.
                    </td>
                  </tr>
                ) : (
                  result.history.map((group, index) =>
                    group.lines.map((line, lineIndex) => (
                      <tr key={line.id}>
                        {lineIndex === 0 ? (
                          <>
                            <td rowSpan={group.lineCount}>{index + 1}</td>
                            <td rowSpan={group.lineCount}>
                              {group.type === "IN" ? "Masuk" : "Keluar"}
                            </td>
                            <td rowSpan={group.lineCount}>
                              {reportDateFormatter.format(group.createdAt)}
                            </td>
                          </>
                        ) : null}
                        <td className="stock-history-report-strong">
                          {line.sku}
                        </td>
                        <td>
                          <span className="stock-history-report-strong">
                            {line.productName}
                          </span>
                          <br />
                          <span className="stock-history-report-muted">
                            {line.variationLabel}
                          </span>
                        </td>
                        <td className="stock-history-report-number stock-history-report-strong">
                          {group.type === "IN" ? "+" : "-"}
                          {line.quantity}
                        </td>
                        {lineIndex === 0 ? (
                          <>
                            <td rowSpan={group.lineCount}>
                              {group.user.name || group.user.username}
                            </td>
                            <td rowSpan={group.lineCount}>
                              {group.note || "-"}
                            </td>
                            <td rowSpan={group.lineCount}>
                              {formatSale(group)}
                            </td>
                          </>
                        ) : null}
                      </tr>
                    ))
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      </article>
    </div>
  );
}

function ReportInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="stock-history-report-meta">
      <p className="stock-history-report-meta-label">
        {label}
      </p>
      <p className="stock-history-report-meta-value">{value}</p>
    </div>
  );
}

function formatSale(group: StockTransactionGroup) {
  if (group.type !== "OUT" || !group.sale) {
    return "-";
  }

  return `${group.sale.receiptNumber} - ${formatStockCurrency(
    group.sale.totalAmount
  )}`;
}
