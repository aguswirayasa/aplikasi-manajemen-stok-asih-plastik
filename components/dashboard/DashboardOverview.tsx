import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardStatCards } from "@/components/dashboard/DashboardStatCards";
import { DashboardTodayCards } from "@/components/dashboard/DashboardTodayCards";
import { LowStockPanel } from "@/components/dashboard/LowStockPanel";
import { RecentTransactionsPanel } from "@/components/dashboard/RecentTransactionsPanel";
import type { DashboardData } from "@/types/dashboard";

export function DashboardOverview({
  data,
  displayName,
}: {
  data: DashboardData;
  displayName: string;
}) {
  return (
    <div className="space-y-6 pb-8">
      <DashboardHeader displayName={displayName} />
      <DashboardStatCards totals={data.totals} />
      <DashboardTodayCards today={data.today} />
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
        <LowStockPanel variants={data.lowStockVariants} />
        <RecentTransactionsPanel transactions={data.recentTransactions} />
      </section>
    </div>
  );
}
