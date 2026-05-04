import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { authOptions } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const data = await getDashboardData();
  const displayName = session.user.name || session.user.username;

  return <DashboardOverview data={data} displayName={displayName} />;
}
