import type { NextRequest } from "next/server";
import {
  ApiError,
  apiResponse,
  requireAdmin,
  withErrorHandler,
} from "@/lib/api-helpers";
import {
  buildSalesPeriodFilter,
  getSalesPerformance,
} from "@/lib/sales";

export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireAdmin();

  const params = new URL(request.url).searchParams;
  const from = params.get("from");
  const to = params.get("to");
  if (!from || !to) {
    throw new ApiError("Tanggal awal dan akhir wajib diisi.", 400);
  }

  const period = buildSalesPeriodFilter(from, to);
  const performance = await getSalesPerformance(new Date(), period);

  return apiResponse(performance);
});
