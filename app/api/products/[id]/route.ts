import { NextRequest } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import {
  ApiError,
  apiResponse,
  requireAdmin,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-helpers";

type ProductUpdateBody = {
  name?: unknown;
  categoryId?: unknown;
  description?: unknown;
  variants?: unknown;
};

type ParsedVariantUpdate = {
  id: string;
  price: number;
  stock: number;
  minStock: number;
  isActive: boolean;
};

type ExistingVariant = {
  id: string;
  sku: string;
  stock: number;
  isActive: boolean;
};

const PRODUCT_EDIT_STOCK_NOTE = "Penyesuaian stok dari edit produk";

export const GET = withErrorHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireAuth();
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      variationTypes: {
        include: { variationType: true },
        orderBy: { sortOrder: "asc" },
      },
      variants: {
        include: {
          values: {
            include: {
              variationValue: true,
            },
          },
        },
      },
    },
  });

  if (!product) {
    throw new ApiError("Produk tidak ditemukan.", 404);
  }

  return apiResponse(product);
});

export const PUT = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await requireAdmin();
  const { id } = await params;
  const body = (await req.json()) as ProductUpdateBody;
  const { name, categoryId, description } = body;

  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    typeof categoryId !== "string"
  ) {
    throw new ApiError("Nama produk dan kategori wajib diisi.", 400);
  }

  const variants = parseVariantUpdates(body.variants);

  const product = await prisma.$transaction(async (tx) => {
    const existingProduct = await tx.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingProduct) {
      throw new ApiError("Produk tidak ditemukan.", 404);
    }

    const category = await tx.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new ApiError("Kategori tidak ditemukan.", 404);
    }

    const existingVariants = await tx.productVariant.findMany({
      where: { productId: id },
      select: { id: true, sku: true, stock: true, isActive: true },
    });
    const existingVariantMap = new Map(
      existingVariants.map((variant) => [variant.id, variant])
    );

    for (const variant of variants) {
      const existingVariant = existingVariantMap.get(variant.id);

      if (!existingVariant) {
        throw new ApiError("Sebagian SKU tidak ditemukan pada produk ini.", 404);
      }

      await updateProductVariant(tx, variant, existingVariant);
      await applyAuditedStockDelta(tx, user.id, variant, existingVariant);
    }

    return tx.product.update({
      where: { id },
      data: {
        name: name.trim(),
        categoryId,
        description:
          typeof description === "string" && description.trim().length > 0
            ? description.trim()
            : null,
      },
      include: {
        category: true,
        variants: true,
      },
    });
  });

  return apiResponse(product, 200, "Produk berhasil diperbarui.");
});

export const DELETE = withErrorHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireAdmin();
  const { id } = await params;

  await prisma.product.delete({
    where: { id },
  });

  return apiResponse({ success: true });
});

function parseVariantUpdates(value: unknown): ParsedVariantUpdate[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ApiError("Data SKU tidak valid.", 400);
  }

  const seenIds = new Set<string>();

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new ApiError("Data SKU tidak valid.", 400);
    }

    const id = item.id;

    if (typeof id !== "string" || id.trim().length === 0) {
      throw new ApiError("ID SKU tidak valid.", 400);
    }

    if (seenIds.has(id)) {
      throw new ApiError("Data SKU duplikat.", 400);
    }

    seenIds.add(id);

    const price = parseNonNegativeNumber(item.price, "Harga SKU tidak valid.");
    const minStock = parseNonNegativeInteger(
      item.minStock,
      "Minimal stok SKU tidak valid."
    );
    const stock = parseNonNegativeInteger(item.stock, "Stok SKU tidak valid.");

    if (typeof item.isActive !== "boolean") {
      throw new ApiError("Status SKU tidak valid.", 400);
    }

    return {
      id,
      price,
      minStock,
      stock,
      isActive: item.isActive,
    };
  });
}

async function updateProductVariant(
  tx: Prisma.TransactionClient,
  variant: ParsedVariantUpdate,
  existingVariant: ExistingVariant
) {
  await tx.productVariant.update({
    where: { id: variant.id },
    data: {
      price: variant.price,
      minStock: variant.minStock,
      isActive: variant.isActive,
    },
  });

  if (variant.stock !== existingVariant.stock && !variant.isActive) {
    throw new ApiError(
      "Aktifkan SKU sebelum mengubah stok dari halaman edit produk.",
      409
    );
  }
}

async function applyAuditedStockDelta(
  tx: Prisma.TransactionClient,
  userId: string,
  variant: ParsedVariantUpdate,
  existingVariant: ExistingVariant
) {
  const delta = variant.stock - existingVariant.stock;

  if (delta === 0) {
    return;
  }

  if (delta > 0) {
    await tx.stockIn.create({
      data: {
        variantId: variant.id,
        quantity: delta,
        note: PRODUCT_EDIT_STOCK_NOTE,
        userId,
      },
    });

    const updated = await tx.productVariant.updateMany({
      where: { id: variant.id, stock: existingVariant.stock, isActive: true },
      data: { stock: { increment: delta } },
    });

    if (updated.count === 0) {
      throw new ApiError(
        `Stok ${existingVariant.sku} berubah saat disimpan. Muat ulang halaman lalu coba lagi.`,
        409
      );
    }

    return;
  }

  const quantityOut = Math.abs(delta);

  if (quantityOut > existingVariant.stock) {
    throw new ApiError(
      `Stok ${existingVariant.sku} tidak cukup. Tersedia ${existingVariant.stock}, diminta ${quantityOut}.`,
      409
    );
  }

  await tx.stockOut.create({
    data: {
      variantId: variant.id,
      quantity: quantityOut,
      note: PRODUCT_EDIT_STOCK_NOTE,
      userId,
    },
  });

  const updated = await tx.productVariant.updateMany({
    where: { id: variant.id, stock: existingVariant.stock, isActive: true },
    data: { stock: { decrement: quantityOut } },
  });

  if (updated.count === 0) {
    throw new ApiError(
      `Stok ${existingVariant.sku} berubah saat disimpan. Muat ulang halaman lalu coba lagi.`,
      409
    );
  }
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
