import { apiResponse, requireAuth, withErrorHandler } from "@/lib/api-helpers";
import { getDashboardData } from "@/lib/dashboard-data";

export const GET = withErrorHandler(async () => {
  const user = await requireAuth();

  const data = await getDashboardData({
    includeOwnerTotals: user.role === "ADMIN",
  });

  return apiResponse(data);
});
