import prisma from "@/lib/prisma";
import {
  mergeStockTransactions,
  stockTransactionInclude,
} from "@/lib/stock-transactions";

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
      include: stockTransactionInclude,
    }),
    prisma.stockOut.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: stockTransactionInclude,
    }),
  ]);

  const recentTransactions = mergeStockTransactions(stockIns, stockOuts, 5);

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
  };
}
