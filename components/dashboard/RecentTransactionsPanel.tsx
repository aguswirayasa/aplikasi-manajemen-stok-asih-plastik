import { ArrowDownLeft, ArrowUpRight, History } from "lucide-react";
import {
  dashboardDateFormatter,
} from "@/lib/dashboard-format";
import {
  DashboardEmptyState,
  DashboardPanel,
} from "@/components/dashboard/DashboardPanel";
import type { DashboardTransaction } from "@/types/dashboard";

export function RecentTransactionsPanel({
  transactions,
}: {
  transactions: DashboardTransaction[];
}) {
  return (
    <DashboardPanel
      icon={<History className="h-5 w-5" />}
      title="Transaksi Terbaru"
      actionHref="/stock/history"
      actionLabel="Riwayat"
    >
      <div className="divide-y divide-[#eceae3]">
        {transactions.length === 0 ? (
          <DashboardEmptyState
            title="Belum ada transaksi"
            description="Stok masuk dan keluar terbaru akan tampil di sini."
          />
        ) : (
          transactions.map((transaction) => (
            <article
              key={`${transaction.type}-${transaction.id}`}
              className="grid grid-cols-[40px_minmax(0,1fr)_auto] gap-3 p-4"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[5px] border border-[#c5c0b1] text-[#ff4f00]">
                {transaction.type === "IN" ? (
                  <ArrowDownLeft className="h-4 w-4" />
                ) : (
                  <ArrowUpRight className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-[#201515]">
                  {transaction.variant.sku}
                </p>
                <p className="truncate text-[13px] text-[#36342e]">
                  {transaction.variant.product.name}
                </p>
                <p className="mt-1 text-[12px] text-[#939084]">
                  {dashboardDateFormatter.format(transaction.createdAt)} oleh{" "}
                  {transaction.user.name || transaction.user.username}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[20px] font-bold leading-none text-[#201515]">
                  {transaction.type === "IN" ? "+" : "-"}
                  {transaction.quantity}
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
                  Qty
                </p>
              </div>
            </article>
          ))
        )}
      </div>
    </DashboardPanel>
  );
}
