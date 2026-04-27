import { apiResponse, requireAuth, withErrorHandler } from "@/lib/api-helpers";
import { getDashboardData } from "@/lib/dashboard-data";

export const GET = withErrorHandler(async () => {
  await requireAuth();

  const data = await getDashboardData();

  return apiResponse(data);
});
