import { NextRequest } from "next/server";
import {
  apiResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-helpers";
import {
  getStockHistory,
  parseStockHistoryFilter,
} from "@/lib/stock-history";

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth();

  const filter = parseStockHistoryFilter(req.nextUrl.searchParams);
  const history = await getStockHistory(filter);

  return apiResponse(history);
});
