import { NextRequest } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import {
  ApiError,
  apiResponse,
  requireAdmin,
  withErrorHandler,
} from "@/lib/api-helpers";

type VariantUpdateBody = {
  price?: unknown;
  stock?: unknown;
  minStock?: unknown;
  isActive?: unknown;
};

export const PUT = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) => {
  await requireAdmin();
  const { id: productId, variantId } = await params;

  const body = (await req.json()) as VariantUpdateBody;

  if (body.stock !== undefined) {
    throw new ApiError(
      "Stok hanya bisa diubah melalui transaksi stok masuk atau stok keluar.",
      409
    );
  }

  const dataToUpdate: Prisma.ProductVariantUpdateInput = {};

  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new ApiError("Harga SKU tidak valid.", 400);
    }
    dataToUpdate.price = price;
  }

  if (body.minStock !== undefined) {
    const minStock = Number(body.minStock);
    if (!Number.isInteger(minStock) || minStock < 0) {
      throw new ApiError("Minimal stok SKU tidak valid.", 400);
    }
    dataToUpdate.minStock = minStock;
  }

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      throw new ApiError("Status SKU tidak valid.", 400);
    }
    dataToUpdate.isActive = body.isActive;
  }

  if (Object.keys(dataToUpdate).length === 0) {
    throw new ApiError("Tidak ada perubahan SKU yang valid.", 400);
  }

  const variant = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, isArchived: true },
    });

    if (!product) {
      throw new ApiError("Produk tidak ditemukan.", 404);
    }

    if (product.isArchived) {
      throw new ApiError("Produk yang sudah diarsipkan tidak bisa diedit.", 409);
    }

    return tx.productVariant.update({
      where: { id: variantId, productId },
      data: dataToUpdate,
    });
  });

  return apiResponse(variant);
});

export const DELETE = withErrorHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) => {
  await requireAdmin();
  const { id: productId, variantId } = await params;

  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, isArchived: true },
    });

    if (!product) {
      throw new ApiError("Produk tidak ditemukan.", 404);
    }

    if (product.isArchived) {
      throw new ApiError("Produk yang sudah diarsipkan tidak bisa diedit.", 409);
    }

    const variant = await tx.productVariant.findFirst({
      where: { id: variantId, productId },
      select: { id: true, stock: true },
    });

    if (!variant) {
      throw new ApiError("SKU tidak ditemukan.", 404);
    }

    const [stockInCount, stockOutCount] = await Promise.all([
      tx.stockIn.count({ where: { variantId } }),
      tx.stockOut.count({ where: { variantId } }),
    ]);

    if (variant.stock === 0 && stockInCount === 0 && stockOutCount === 0) {
      await tx.productVariant.delete({
        where: { id: variantId, productId },
      });
      return;
    }

    await tx.productVariant.update({
      where: { id: variantId, productId },
      data: { isActive: false },
    });
  });

  return apiResponse({ success: true });
});
