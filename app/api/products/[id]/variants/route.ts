import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  ApiError,
  apiResponse,
  requireAdmin,
  withErrorHandler,
} from "@/lib/api-helpers";
import {
  createProductVariants,
  parseVariationCombinations,
} from "@/lib/product-variant-creation";

type VariantCreateBody = {
  combinations?: unknown;
  defaultPrice?: unknown;
};

export const POST = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireAdmin();
  const { id: productId } = await params;

  const body = (await req.json()) as VariantCreateBody;
  const combinations = parseVariationCombinations(body.combinations);
  const defaultPrice = parseDefaultPrice(body.defaultPrice);

  const createdVariants = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });

    if (!product) {
      throw new ApiError("Produk tidak ditemukan.", 404);
    }

    return createProductVariants(tx, product, combinations, defaultPrice);
  });

  return apiResponse(createdVariants, 201);
});

function parseDefaultPrice(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const price = Number(value);

  if (!Number.isFinite(price) || price < 0) {
    throw new ApiError("Harga default tidak valid.", 400);
  }

  return price;
}
