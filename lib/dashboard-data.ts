import prisma from "@/lib/prisma";
import {
  mergeStockTransactions,
  stockTransactionInclude,
} from "@/lib/stock-transactions";

export async function getDashboardData() {
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
    prisma.product.count(),
    prisma.productVariant.count({ where: { isActive: true } }),
    prisma.productVariant.aggregate({
      where: { isActive: true },
      _sum: { stock: true },
    }),
    prisma.productVariant.count({
      where: {
        isActive: true,
        stock: { lte: prisma.productVariant.fields.minStock },
      },
    }),
    prisma.productVariant.findMany({
      where: {
        isActive: true,
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
      take: 10,
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
    totals: {
      products: totalProducts,
      activeSkus: totalVariants,
      totalStock: totalStock._sum.stock || 0,
      lowStock: lowStockCount,
    },
    today: {
      stockIn: stockInsToday._sum.quantity || 0,
      stockOut: stockOutsToday._sum.quantity || 0,
    },
    lowStockVariants,
    recentTransactions,
  };
}
