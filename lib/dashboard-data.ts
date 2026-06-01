import prisma from "@/lib/prisma";
import {
  buildSalesPeriodFilter,
  getSalesReport,
  REPORT_TIMEZONE,
} from "@/lib/sales";
import {
  mergeStockTransactions,
  stockInTransactionInclude,
  stockOutTransactionInclude,
} from "@/lib/stock-transactions";
import { formatInTimeZone } from "date-fns-tz";

export async function getDashboardData({
  includeOwnerTotals = true,
  lowStockLimit = 5,
}: {
  includeOwnerTotals?: boolean;
  lowStockLimit?: number;
} = {}) {
  const todayStr = formatInTimeZone(new Date(), REPORT_TIMEZONE, "yyyy-MM-dd");
  const todayPeriod = buildSalesPeriodFilter(todayStr, todayStr);

  const [
    totalProducts,
    totalVariants,
    totalStock,
    lowStockCount,
    lowStockVariants,
    stockInsToday,
    stockOutsToday,
    stockIns,
    stockOuts,
  ] = await Promise.all([
    prisma.product.count({ where: { isArchived: false } }),
    prisma.productVariant.count({
      where: { isActive: true, product: { is: { isArchived: false } } },
    }),
    prisma.productVariant.aggregate({
      where: { isActive: true, product: { is: { isArchived: false } } },
      _sum: { stock: true },
    }),
    prisma.productVariant.count({
      where: {
        isActive: true,
        product: { is: { isArchived: false } },
        stock: { lte: prisma.productVariant.fields.minStock },
      },
    }),
    prisma.productVariant.findMany({
      where: {
        isActive: true,
        product: { is: { isArchived: false } },
        stock: { lte: prisma.productVariant.fields.minStock },
      },
      include: {
        product: true,
        values: {
          include: {
            variationValue: {
              include: {
                variationType: true,
              },
            },
          },
        },
      },
      orderBy: [{ stock: "asc" }, { sku: "asc" }],
      take: lowStockLimit,
    }),
    prisma.stockIn.aggregate({
      where: { createdAt: { gte: todayPeriod.from, lte: todayPeriod.to } },
      _sum: { quantity: true },
    }),
    prisma.stockOut.aggregate({
      where: { createdAt: { gte: todayPeriod.from, lte: todayPeriod.to } },
      _sum: { quantity: true },
    }),
    prisma.stockIn.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: stockInTransactionInclude,
    }),
    prisma.stockOut.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: stockOutTransactionInclude,
    }),
  ]);

  const recentTransactions = mergeStockTransactions(stockIns, stockOuts, 5);

  // Dashboard memakai hari bisnis Asia/Singapore agar hasil produksi tidak bergantung timezone server.
  const salesReport = includeOwnerTotals
    ? await getSalesReport(todayPeriod, 5)
    : null;

  return {
    totals: includeOwnerTotals
      ? {
          products: totalProducts,
          activeSkus: totalVariants,
          totalStock: totalStock._sum.stock || 0,
          lowStock: lowStockCount,
        }
      : null,
    today: {
      stockIn: stockInsToday._sum.quantity || 0,
      stockOut: stockOutsToday._sum.quantity || 0,
    },
    lowStockVariants,
    recentTransactions,
    salesReport,
  };
}
