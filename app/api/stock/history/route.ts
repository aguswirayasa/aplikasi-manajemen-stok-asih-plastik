import { NextRequest } from "next/server";
import {
  ApiError,
  apiResponse,
  requireAdmin,
  withErrorHandler,
} from "@/lib/api-helpers";
import prisma from "@/lib/prisma";
import {
  mergeStockTransactions,
  stockTransactionInclude,
} from "@/lib/stock-transactions";

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin();

  const { searchParams } = new URL(req.url);
  const rawLimit = Number(searchParams.get("limit") || "50");

  if (!Number.isInteger(rawLimit)) {
    throw new ApiError("Limit harus berupa angka.", 400);
  }

  const limit = Math.min(Math.max(rawLimit, 1), 200);
  const [stockIns, stockOuts] = await Promise.all([
    prisma.stockIn.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: stockTransactionInclude,
    }),
    prisma.stockOut.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: stockTransactionInclude,
    }),
  ]);

  const history = mergeStockTransactions(stockIns, stockOuts, limit);

  return apiResponse(history);
});
