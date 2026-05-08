import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { getDashboardData } from "@/lib/dashboard-data";
import { requirePageAuth } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requirePageAuth();
  const isAdmin = user.role === "ADMIN";

  const data = await getDashboardData({ includeOwnerTotals: isAdmin });
  const displayName = user.name || user.username;

  return (
    <DashboardOverview
      data={data}
      displayName={displayName}
      isAdmin={isAdmin}
    />
  );
}
