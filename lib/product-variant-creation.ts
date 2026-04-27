import type { Prisma, Product, ProductVariant } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-helpers";
import { generateSkuString } from "@/lib/sku-generator";

export type VariationCombinationsInput = Record<string, string[]>;

type ProductForVariantCreation = Pick<Product, "id" | "name">;

export function parseVariationCombinations(input: unknown): VariationCombinationsInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ApiError("Format kombinasi variasi tidak valid.", 400);
  }

  const combinations: VariationCombinationsInput = {};

  for (const [typeId, valueIds] of Object.entries(input)) {
    if (!Array.isArray(valueIds)) {
      throw new ApiError("Format nilai variasi tidak valid.", 400);
    }

    const uniqueValueIds = [...new Set(valueIds)];
    if (uniqueValueIds.some((valueId) => typeof valueId !== "string")) {
      throw new ApiError("Nilai variasi tidak valid.", 400);
    }

    if (uniqueValueIds.length > 0) {
      combinations[typeId] = uniqueValueIds;
    }
  }

  return combinations;
}

export async function createProductVariants(
  tx: Prisma.TransactionClient,
  product: ProductForVariantCreation,
  combinations: VariationCombinationsInput,
  defaultPrice: number
): Promise<ProductVariant[]> {
  const productVariationTypes = await tx.productVariationType.findMany({
    where: { productId: product.id },
    orderBy: { sortOrder: "asc" },
    select: { variationTypeId: true },
  });
  const orderedTypeIds = productVariationTypes.map((item) => item.variationTypeId);
  const selectedTypeIds = orderedTypeIds.filter(
    (typeId) => (combinations[typeId]?.length ?? 0) > 0
  );

  if (Object.keys(combinations).some((typeId) => !orderedTypeIds.includes(typeId))) {
    throw new ApiError("Kombinasi variasi tidak sesuai dengan produk.", 400);
  }

  if (selectedTypeIds.length === 0) {
    return [];
  }

  const allValueIds = selectedTypeIds.flatMap((typeId) => combinations[typeId]);
  const valuesData = await tx.variationValue.findMany({
    where: { id: { in: allValueIds } },
    select: { id: true, value: true, variationTypeId: true },
  });

  if (valuesData.length !== allValueIds.length) {
    throw new ApiError("Sebagian nilai variasi tidak ditemukan.", 404);
  }

  const valueMap = new Map(valuesData.map((value) => [value.id, value]));

  for (const typeId of selectedTypeIds) {
    for (const valueId of combinations[typeId]) {
      const value = valueMap.get(valueId);
      if (!value || value.variationTypeId !== typeId) {
        throw new ApiError("Nilai variasi tidak sesuai dengan tipe variasinya.", 400);
      }
    }
  }

  const createdVariants: ProductVariant[] = [];

  for (const valueIds of buildCombinationRows(selectedTypeIds, combinations)) {
    const valueNames = valueIds.map((valueId) => valueMap.get(valueId)?.value ?? "");
    const skuBase = generateSkuString(product.name, valueNames);
    const sku = await getAvailableSku(tx, skuBase);

    const variant = await tx.productVariant.create({
      data: {
        productId: product.id,
        sku,
        price: defaultPrice,
        values: {
          create: valueIds.map((variationValueId) => ({
            variationValueId,
          })),
        },
      },
    });

    createdVariants.push(variant);
  }

  return createdVariants;
}

function buildCombinationRows(
  orderedTypeIds: string[],
  combinations: VariationCombinationsInput
) {
  const rows: string[][] = [];

  function visit(typeIndex: number, current: string[]) {
    if (typeIndex === orderedTypeIds.length) {
      rows.push([...current]);
      return;
    }

    const typeId = orderedTypeIds[typeIndex];
    for (const valueId of combinations[typeId]) {
      current.push(valueId);
      visit(typeIndex + 1, current);
      current.pop();
    }
  }

  visit(0, []);
  return rows;
}

async function getAvailableSku(tx: Prisma.TransactionClient, skuBase: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const sku = attempt === 0 ? skuBase : `${skuBase}-${String(attempt + 1).padStart(2, "0")}`;
    const existing = await tx.productVariant.findUnique({ where: { sku } });

    if (!existing) {
      return sku;
    }
  }

  throw new ApiError("SKU unik tidak bisa dibuat. Ubah nama produk atau variasi.", 409);
}
