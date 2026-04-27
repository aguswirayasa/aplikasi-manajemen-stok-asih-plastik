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

  const variant = await prisma.productVariant.update({
    where: { id: variantId, productId },
    data: dataToUpdate,
  });

  return apiResponse(variant);
});

export const DELETE = withErrorHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) => {
  await requireAdmin();
  const { id: productId, variantId } = await params;

  await prisma.productVariant.delete({
    where: { id: variantId, productId },
  });

  return apiResponse({ success: true });
});
