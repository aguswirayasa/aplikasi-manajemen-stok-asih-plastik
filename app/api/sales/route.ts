import { NextRequest } from "next/server";
import {
  apiResponse,
  requireAdmin,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-helpers";
import {
  checkoutSale,
  getSalesReport,
  parseSaleCheckoutPayload,
  parseSalesPeriodFilter,
} from "@/lib/sales";

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin();

  const period = parseSalesPeriodFilter(new URL(req.url).searchParams);
  const report = await getSalesReport(period);

  return apiResponse(report);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth();
  const body = await req.json();
  const input = parseSaleCheckoutPayload(body);
  const sale = await checkoutSale(user.id, input);

  return apiResponse(sale, 201, "Transaksi penjualan berhasil dicatat.");
});
