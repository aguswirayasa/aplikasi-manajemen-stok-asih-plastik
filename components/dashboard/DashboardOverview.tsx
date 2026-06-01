import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardStatCards } from "@/components/dashboard/DashboardStatCards";
import { DashboardTodayCards } from "@/components/dashboard/DashboardTodayCards";
import { LowStockPanel } from "@/components/dashboard/LowStockPanel";
import { RecentTransactionsPanel } from "@/components/dashboard/RecentTransactionsPanel";
import { SalesReportPanel } from "@/components/dashboard/SalesReportPanel";
import type { DashboardData, DashboardIcon } from "@/types/dashboard";

export function DashboardOverview({
  data,
  displayName,
  isAdmin,
}: {
  data: DashboardData;
  displayName: string;
  isAdmin: boolean;
}) {
  const shouldStretchPanels =
    data.lowStockVariants.length >= 5 && data.recentTransactions.length >= 5;

  return (
    <div className="space-y-6 pb-8">
      <DashboardHeader displayName={displayName} />
      {isAdmin && data.totals && <DashboardStatCards totals={data.totals} />}

      {/* Laporan penjualan dan aktivitas stok hari ini dalam satu baris dua kolom */}
      {isAdmin && data.salesReport ? (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <SalesReportPanel report={data.salesReport} />
          <StockActivitySection today={data.today} />
        </div>
      ) : (
        <DashboardTodayCards today={data.today} />
      )}

      <section
        className={`grid grid-cols-1 items-start gap-5 lg:grid-cols-2 ${
          shouldStretchPanels ? "lg:items-stretch" : ""
        }`}
      >
        <LowStockPanel variants={data.lowStockVariants} />
        <RecentTransactionsPanel transactions={data.recentTransactions} />
      </section>
    </div>
  );
}

// Komponen aktivitas stok hari ini yang ditampilkan berdampingan dengan laporan penjualan
function StockActivitySection({ today }: { today: DashboardData["today"] }) {
  return (
    <section className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]">
      <div className="flex items-start gap-3 border-b border-[#c5c0b1] bg-[#eceae3]/35 p-4">
        <ArrowDownLeft className="mt-1 h-5 w-5 text-[#ff4f00]" />
        <div>
          <h2 className="text-[18px] font-bold text-[#201515]">
            Pergerakan Stok Hari Ini
          </h2>
          <p className="text-[13px] text-[#939084]">
            Jumlah barang masuk dan keluar pada hari ini.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
        <StockActivityCard
          label="Barang Masuk"
          value={today.stockIn}
          icon={<ArrowDownLeft className="h-5 w-5" />}
        />
        <StockActivityCard
          label="Barang Keluar"
          value={today.stockOut}
          icon={<ArrowUpRight className="h-5 w-5" />}
        />
      </div>
    </section>
  );
}

function StockActivityCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: DashboardIcon;
}) {
  return (
    <article className="flex items-center justify-between gap-4 rounded-[5px] border border-[#c5c0b1] bg-[#eceae3]/30 p-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
          {label}
        </p>
        <p className="mt-1 text-[18px] font-bold leading-none text-[#201515]">
          {value}
        </p>
      </div>
      <span className="flex h-11 w-11 items-center justify-center rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] text-[#ff4f00]">
        {icon}
      </span>
    </article>
  );
}
