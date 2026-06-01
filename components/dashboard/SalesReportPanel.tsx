import { ReceiptText } from "lucide-react";
import { formatStockCurrencyCompact } from "@/lib/stock-format";
import type { DashboardData } from "@/types/dashboard";

export function SalesReportPanel({
  report,
}: {
  report: NonNullable<DashboardData["salesReport"]>;
}) {
  return (
    <section className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]">
      <div className="flex items-start gap-3 border-b border-[#c5c0b1] bg-[#eceae3]/35 p-4">
        <ReceiptText className="mt-1 h-5 w-5 text-[#ff4f00]" />
        <div>
          <h2 className="text-[18px] font-bold text-[#201515]">
            Report Penjualan Hari Ini
          </h2>
          <p className="text-[13px] text-[#939084]">
            Omzet dan transaksi penjualan hari ini.
          </p>
        </div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-3">
        <Metric label="Omzet hari ini" value={formatStockCurrencyCompact(report.revenue)} />
        <Metric label="Transaksi" value={`${report.transactionCount}`} />
        <Metric label="Item terjual" value={`${report.itemCount}`} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-[5px] border border-[#c5c0b1] bg-[#eceae3]/30 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
        {label}
      </p>
      <p className="mt-1 break-all text-[18px] font-bold leading-tight text-[#201515]">
        {value}
      </p>
    </div>
  );
}
