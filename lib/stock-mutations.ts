import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-helpers";
import prisma from "@/lib/prisma";
import type { StockItemInput } from "@/lib/stock-validation";

export const stockMutationInclude = {
  variant: {
    include: {
      product: true,
    },
  },
  user: {
    select: { id: true, name: true, username: true },
  },
} satisfies Prisma.StockInInclude;

export type StockInMutation = Prisma.StockInGetPayload<{
  include: typeof stockMutationInclude;
}>;

export type StockOutMutation = Prisma.StockOutGetPayload<{
  include: typeof stockMutationInclude;
}>;

export async function recordStockIn(
  userId: string,
  items: StockItemInput[],
  note: string | null
): Promise<StockInMutation[]> {
  const variantIds = [...new Set(items.map((item) => item.variantId))];

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, isActive: true },
  });

  if (variants.length !== variantIds.length) {
    throw new ApiError("SKU tidak ditemukan.", 404);
  }

  if (variants.some((variant) => !variant.isActive)) {
    throw new ApiError("SKU tidak aktif dan tidak bisa menerima stok.", 409);
  }

  return prisma.$transaction(async (tx) => {
    const createdIds: string[] = [];

    for (const item of items) {
      const stockIn = await tx.stockIn.create({
        data: {
          variantId: item.variantId,
          quantity: item.quantity,
          note,
          userId,
        },
      });

      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });

      createdIds.push(stockIn.id);
    }

    return tx.stockIn.findMany({
      where: { id: { in: createdIds } },
      orderBy: { createdAt: "desc" },
      include: stockMutationInclude,
    });
  });
}

export async function recordStockOut(
  userId: string,
  items: StockItemInput[],
  note: string | null
): Promise<StockOutMutation[]> {
  return prisma.$transaction(async (tx) => {
    const createdIds: string[] = [];

    for (const item of items) {
      const updated = await tx.productVariant.updateMany({
        where: {
          id: item.variantId,
          isActive: true,
          stock: { gte: item.quantity },
        },
        data: {
          stock: { decrement: item.quantity },
        },
      });

      if (updated.count === 0) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          select: { id: true, isActive: true, sku: true, stock: true },
        });

        if (!variant) {
          throw new ApiError("SKU tidak ditemukan.", 404);
        }

        if (!variant.isActive) {
          throw new ApiError("SKU tidak aktif dan tidak bisa dikeluarkan.", 409);
        }

        throw new ApiError(
          `Stok ${variant.sku} tidak cukup. Tersedia ${variant.stock}, diminta ${item.quantity}.`,
          409
        );
      }

      const stockOut = await tx.stockOut.create({
        data: {
          variantId: item.variantId,
          quantity: item.quantity,
          note,
          userId,
        },
      });

      createdIds.push(stockOut.id);
    }

    return tx.stockOut.findMany({
      where: { id: { in: createdIds } },
      orderBy: { createdAt: "desc" },
      include: stockMutationInclude,
    });
  });
}
