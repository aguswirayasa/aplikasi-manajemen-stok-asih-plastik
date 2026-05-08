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
  parseProductVariantInputs,
} from "@/lib/product-variant-creation";

type ProductCreateBody = {
  name?: unknown;
  categoryId?: unknown;
  description?: unknown;
  variationTypeIds?: unknown;
  variants?: unknown;
};

export const GET = withErrorHandler(async () => {
  await requireAuth();

  const products = await prisma.product.findMany({
    where: { isArchived: false },
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
  const user = await requireAdmin();

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
  const variants = parseProductVariantInputs(body.variants);

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

    await createProductVariants(tx, createdProduct, variants, {
      initialStockUserId: user.id,
    });

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
