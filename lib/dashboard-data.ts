import prisma from "@/lib/prisma";
import { buildSalesPeriodFilter } from "@/lib/sales";
import { getSalesReport } from "@/lib/sales";
import {
  mergeStockTransactions,
  stockInTransactionInclude,
  stockOutTransactionInclude,
} from "@/lib/stock-transactions";
import { format } from "date-fns";

export async function getDashboardData({
  includeOwnerTotals = true,
  lowStockLimit = 5,
}: {
  includeOwnerTotals?: boolean;
  lowStockLimit?: number;
} = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
      where: { createdAt: { gte: today } },
      _sum: { quantity: true },
    }),
    prisma.stockOut.aggregate({
      where: { createdAt: { gte: today } },
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

  // Bangun periode hari ini untuk laporan penjualan
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const salesReport = includeOwnerTotals
    ? await getSalesReport(buildSalesPeriodFilter(todayStr, todayStr), 5)
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
