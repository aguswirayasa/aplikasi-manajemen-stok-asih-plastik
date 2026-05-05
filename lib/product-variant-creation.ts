import type { Prisma, Product, ProductVariant } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-helpers";
import { generateSkuString } from "@/lib/sku-generator";

export type VariationCombinationsInput = Record<string, string[]>;

export type ProductVariantCreationInput = {
  valueIds: string[];
  price: number;
  stock: number;
  minStock: number;
};

type ProductForVariantCreation = Pick<Product, "id" | "name">;

const INITIAL_STOCK_NOTE = "Stok awal dari wizard produk";

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

export function parseProductVariantInputs(input: unknown) {
  if (!Array.isArray(input) || input.length === 0) {
    throw new ApiError("Pilih minimal satu kombinasi SKU.", 400);
  }

  return input.map((item) => {
    if (!isRecord(item)) {
      throw new ApiError("Data SKU tidak valid.", 400);
    }

    if (!Array.isArray(item.valueIds) || item.valueIds.length === 0) {
      throw new ApiError("Kombinasi nilai SKU tidak valid.", 400);
    }

    const valueIds = [...new Set(item.valueIds)];

    if (valueIds.length !== item.valueIds.length) {
      throw new ApiError("Kombinasi nilai SKU duplikat.", 400);
    }

    if (valueIds.some((valueId) => typeof valueId !== "string")) {
      throw new ApiError("Nilai variasi SKU tidak valid.", 400);
    }

    return {
      valueIds,
      price: parseNonNegativeNumber(item.price, "Harga SKU tidak valid."),
      stock: parseNonNegativeInteger(item.stock, "Stok awal SKU tidak valid."),
      minStock: parseNonNegativeInteger(
        item.minStock,
        "Minimal stok SKU tidak valid."
      ),
    };
  });
}

export async function createProductVariants(
  tx: Prisma.TransactionClient,
  product: ProductForVariantCreation,
  variants: ProductVariantCreationInput[],
  options: { initialStockUserId?: string } = {}
): Promise<ProductVariant[]> {
  const productVariationTypes = await tx.productVariationType.findMany({
    where: { productId: product.id },
    orderBy: { sortOrder: "asc" },
    select: { variationTypeId: true },
  });
  const orderedTypeIds = productVariationTypes.map((item) => item.variationTypeId);

  if (orderedTypeIds.length === 0) {
    throw new ApiError("Produk belum memiliki tipe variasi.", 400);
  }

  const allValueIds = variants.flatMap((variant) => variant.valueIds);
  const valuesData = await tx.variationValue.findMany({
    where: { id: { in: allValueIds } },
    select: { id: true, value: true, variationTypeId: true },
  });

  if (valuesData.length !== new Set(allValueIds).size) {
    throw new ApiError("Sebagian nilai variasi tidak ditemukan.", 404);
  }

  const valueMap = new Map(valuesData.map((value) => [value.id, value]));
  const seenCombinationKeys = new Set<string>();
  const createdVariants: ProductVariant[] = [];

  for (const variantInput of variants) {
    const orderedValueIds = orderAndValidateValueIds(
      variantInput.valueIds,
      orderedTypeIds,
      valueMap
    );
    const combinationKey = orderedValueIds.join("|");

    if (seenCombinationKeys.has(combinationKey)) {
      throw new ApiError("Kombinasi SKU duplikat.", 400);
    }

    seenCombinationKeys.add(combinationKey);

    const valueNames = orderedValueIds.map(
      (valueId) => valueMap.get(valueId)?.value ?? ""
    );
    const skuBase = generateSkuString(product.name, valueNames);
    const sku = await getAvailableSku(tx, skuBase);

    const variant = await tx.productVariant.create({
      data: {
        productId: product.id,
        sku,
        price: variantInput.price,
        minStock: variantInput.minStock,
        values: {
          create: orderedValueIds.map((variationValueId) => ({
            variationValueId,
          })),
        },
      },
    });

    if (variantInput.stock > 0) {
      if (!options.initialStockUserId) {
        throw new ApiError("User pencatat stok awal tidak valid.", 400);
      }

      await tx.stockIn.create({
        data: {
          variantId: variant.id,
          quantity: variantInput.stock,
          note: INITIAL_STOCK_NOTE,
          userId: options.initialStockUserId,
        },
      });
      await tx.productVariant.update({
        where: { id: variant.id },
        data: { stock: { increment: variantInput.stock } },
      });
    }

    createdVariants.push({
      ...variant,
      stock: variantInput.stock,
    });
  }

  return createdVariants;
}

export function variantInputsFromCombinations(
  combinations: VariationCombinationsInput,
  defaultPrice: number
): ProductVariantCreationInput[] {
  const typeIds = Object.keys(combinations).filter(
    (typeId) => combinations[typeId].length > 0
  );

  if (typeIds.length === 0) {
    return [];
  }

  return buildCombinationRows(typeIds, combinations).map((valueIds) => ({
    valueIds,
    price: defaultPrice,
    stock: 0,
    minStock: 0,
  }));
}

function orderAndValidateValueIds(
  valueIds: string[],
  orderedTypeIds: string[],
  valueMap: Map<string, { id: string; value: string; variationTypeId: string }>
) {
  const valueByTypeId = new Map<string, string>();

  for (const valueId of valueIds) {
    const value = valueMap.get(valueId);

    if (!value) {
      throw new ApiError("Sebagian nilai variasi tidak ditemukan.", 404);
    }

    if (!orderedTypeIds.includes(value.variationTypeId)) {
      throw new ApiError("Nilai variasi tidak sesuai dengan produk.", 400);
    }

    if (valueByTypeId.has(value.variationTypeId)) {
      throw new ApiError("Satu tipe variasi hanya boleh punya satu nilai per SKU.", 400);
    }

    valueByTypeId.set(value.variationTypeId, valueId);
  }

  if (valueByTypeId.size !== orderedTypeIds.length) {
    throw new ApiError("Kombinasi SKU belum lengkap.", 400);
  }

  return orderedTypeIds.map((typeId) => valueByTypeId.get(typeId) ?? "");
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
    const sku =
      attempt === 0
        ? skuBase
        : `${skuBase}-${String(attempt + 1).padStart(2, "0")}`;
    const existing = await tx.productVariant.findUnique({ where: { sku } });

    if (!existing) {
      return sku;
    }
  }

  throw new ApiError("SKU unik tidak bisa dibuat. Ubah nama produk atau variasi.", 409);
}

function parseNonNegativeInteger(value: unknown, message: string) {
  const parsed = parseNumberLike(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ApiError(message, 400);
  }

  return parsed;
}

function parseNonNegativeNumber(value: unknown, message: string) {
  const parsed = parseNumberLike(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ApiError(message, 400);
  }

  return parsed;
}

function parseNumberLike(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return Number(value);
  }

  return Number.NaN;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
