import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  ApiError,
  apiResponse,
  requireAdmin,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-helpers";
import {
  createProductVariants,
  parseVariationCombinations,
} from "@/lib/product-variant-creation";

type ProductCreateBody = {
  name?: unknown;
  categoryId?: unknown;
  description?: unknown;
  variationTypeIds?: unknown;
  combinations?: unknown;
  defaultPrice?: unknown;
};

export const GET = withErrorHandler(async (_req: NextRequest) => {
  await requireAuth();

  const products = await prisma.product.findMany({
    include: {
      category: true,
      variants: {
        include: {
          values: {
            include: {
              variationValue: {
                include: { variationType: true },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return apiResponse(products);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin();

  const body = (await req.json()) as ProductCreateBody;
  const { name, categoryId, description, variationTypeIds } = body;

  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    typeof categoryId !== "string"
  ) {
    throw new ApiError("Nama produk dan kategori wajib diisi.", 400);
  }

  const selectedVariationTypeIds = parseVariationTypeIds(variationTypeIds);
  const defaultPrice = parseDefaultPrice(body.defaultPrice);
  const combinations =
    body.combinations === undefined
      ? undefined
      : parseVariationCombinations(body.combinations);

  const product = await prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new ApiError("Kategori tidak ditemukan.", 404);
    }

    const variationTypeCount = await tx.variationType.count({
      where: { id: { in: selectedVariationTypeIds } },
    });

    if (variationTypeCount !== selectedVariationTypeIds.length) {
      throw new ApiError("Sebagian tipe variasi tidak ditemukan.", 404);
    }

    const createdProduct = await tx.product.create({
      data: {
        name: name.trim(),
        categoryId,
        description:
          typeof description === "string" && description.trim().length > 0
            ? description.trim()
            : null,
        variationTypes: {
          create: selectedVariationTypeIds.map((id, index) => ({
            variationTypeId: id,
            sortOrder: index + 1,
          })),
        },
      },
      include: {
        variationTypes: true,
      },
    });

    if (combinations) {
      await createProductVariants(tx, createdProduct, combinations, defaultPrice);
    }

    return createdProduct;
  });

  return apiResponse(product, 201);
});

function parseVariationTypeIds(value: unknown) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ApiError("Tipe variasi produk tidak valid.", 400);
  }

  return [...new Set(value)];
}

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
