import type { Prisma } from "@/generated/prisma/client";

export const stockTransactionInclude = {
  variant: {
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
  },
  user: {
    select: { name: true, username: true },
  },
} satisfies Prisma.StockInInclude;

export type StockInTransaction = Prisma.StockInGetPayload<{
  include: typeof stockTransactionInclude;
}>;

export type StockOutTransaction = Prisma.StockOutGetPayload<{
  include: typeof stockTransactionInclude;
}>;

export type MergedStockTransaction =
  | (StockInTransaction & { type: "IN" })
  | (StockOutTransaction & { type: "OUT" });

export function mergeStockTransactions(
  stockIns: StockInTransaction[],
  stockOuts: StockOutTransaction[],
  limit: number
): MergedStockTransaction[] {
  return [
    ...stockIns.map((item) => ({ ...item, type: "IN" as const })),
    ...stockOuts.map((item) => ({ ...item, type: "OUT" as const })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}
