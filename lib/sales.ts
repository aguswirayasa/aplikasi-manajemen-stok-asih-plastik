import { endOfDay, format, isValid, parseISO, startOfDay } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-helpers";
import prisma from "@/lib/prisma";

export const REPORT_TIMEZONE = "Asia/Singapore";
const MAX_SALE_ITEMS = 100;
const MAX_LATEST_SALES = 10;

export type SaleCheckoutItemInput = {
  variantId: string;
  quantity: number;
};

export type SaleCheckoutInput = {
  items: SaleCheckoutItemInput[];
  paidAmount: number;
};

export type SalesPeriodFilter = {
  from: Date;
  to: Date;
  fromInput: string;
  toInput: string;
};

export const saleDetailInclude = {
  cashier: {
    select: { id: true, name: true, username: true },
  },
  items: {
    include: {
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
      stockOut: true,
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.SaleInclude;

export type SaleDetail = Prisma.SaleGetPayload<{
  include: typeof saleDetailInclude;
}>;

export type SalesReport = {
  period: {
    fromInput: string;
    toInput: string;
  };
  revenue: number;
  transactionCount: number;
  itemCount: number;
  latestSales: SaleDetail[];
};

export function parseSaleCheckoutPayload(body: unknown): SaleCheckoutInput {
  if (!body || typeof body !== "object") {
    throw new ApiError("Payload checkout tidak valid.", 400);
  }

  const value = body as { items?: unknown; paidAmount?: unknown };

  if (!Array.isArray(value.items) || value.items.length === 0) {
    throw new ApiError("Tambahkan minimal satu SKU ke cart.", 400);
  }

  if (value.items.length > MAX_SALE_ITEMS) {
    throw new ApiError("Item checkout terlalu banyak.", 400);
  }

  const items = value.items.map((item) => {
    if (!item || typeof item !== "object") {
      throw new ApiError("Data item checkout tidak valid.", 400);
    }

    const line = item as { variantId?: unknown; quantity?: unknown };

    if (typeof line.variantId !== "string" || line.variantId.trim() === "") {
      throw new ApiError("SKU checkout tidak valid.", 400);
    }

    const quantity = line.quantity;

    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) {
      throw new ApiError("Quantity checkout harus angka lebih dari 0.", 400);
    }

    return {
      variantId: line.variantId,
      quantity,
    };
  });

  const paidAmount = normalizeMoneyInput(value.paidAmount, "Uang dibayar");

  return {
    items: combineDuplicateItems(items),
    paidAmount,
  };
}

export function parseSalesPeriodFilter(params: URLSearchParams): SalesPeriodFilter {
  const today = format(new Date(), "yyyy-MM-dd");
  const fromInput = params.get("from") || today;
  const toInput = params.get("to") || fromInput;

  return buildSalesPeriodFilter(fromInput, toInput);
}

export function buildSalesPeriodFilter(
  fromInput: string,
  toInput: string
): SalesPeriodFilter {
  const fromDate = parseReportDate(fromInput, "Tanggal awal");
  const toDate = parseReportDate(toInput, "Tanggal akhir");

  if (fromDate.getTime() > toDate.getTime()) {
    throw new ApiError("Tanggal awal tidak boleh melewati tanggal akhir.", 400);
  }

  return {
    from: fromZonedTime(startOfDay(fromDate), REPORT_TIMEZONE),
    to: fromZonedTime(endOfDay(toDate), REPORT_TIMEZONE),
    fromInput,
    toInput,
  };
}

export async function checkoutSale(
  cashierId: string,
  input: SaleCheckoutInput
): Promise<SaleDetail> {
  return prisma.$transaction(async (tx) => {
    const variantIds = input.items.map((item) => item.variantId);
    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        sku: true,
        price: true,
        stock: true,
        isActive: true,
        product: { select: { isArchived: true } },
      },
    });
    const variantById = new Map(variants.map((variant) => [variant.id, variant]));

    if (variants.length !== variantIds.length) {
      throw new ApiError("Sebagian SKU tidak ditemukan.", 404);
    }

    const calculatedItems = input.items.map((item) => {
      const variant = variantById.get(item.variantId);

      if (!variant) {
        throw new ApiError("SKU tidak ditemukan.", 404);
      }

      if (!variant.isActive) {
        throw new ApiError(`SKU ${variant.sku} tidak aktif.`, 409);
      }

      if (variant.product.isArchived) {
        throw new ApiError(`Produk untuk SKU ${variant.sku} sudah diarsipkan.`, 409);
      }

      const unitPrice = Number(variant.price);
      const subtotal = unitPrice * item.quantity;

      return {
        ...item,
        sku: variant.sku,
        unitPrice,
        subtotal,
      };
    });
    const totalAmount = calculatedItems.reduce(
      (total, item) => total + item.subtotal,
      0
    );

    if (input.paidAmount < totalAmount) {
      throw new ApiError("Uang dibayar kurang dari total transaksi.", 400);
    }

    const sale = await tx.sale.create({
      data: {
        receiptNumber: buildReceiptNumber(),
        totalAmount,
        paidAmount: input.paidAmount,
        changeAmount: input.paidAmount - totalAmount,
        cashierId,
      },
    });

    for (const item of calculatedItems) {
      const updated = await tx.productVariant.updateMany({
        where: {
          id: item.variantId,
          isActive: true,
          product: { is: { isArchived: false } },
          stock: { gte: item.quantity },
        },
        data: {
          stock: { decrement: item.quantity },
        },
      });

      if (updated.count === 0) {
        const latest = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          select: { sku: true, stock: true },
        });

        throw new ApiError(
          `Stok ${latest?.sku || item.sku} tidak cukup. Tersedia ${
            latest?.stock ?? 0
          }, diminta ${item.quantity}.`,
          409
        );
      }

      const saleItem = await tx.saleItem.create({
        data: {
          saleId: sale.id,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        },
      });

      await tx.stockOut.create({
        data: {
          variantId: item.variantId,
          quantity: item.quantity,
          note: `Penjualan ${sale.receiptNumber}`,
          // Semua barang keluar dalam satu penjualan berbagi batchId = id penjualan
          batchId: sale.id,
          userId: cashierId,
          saleItemId: saleItem.id,
        },
      });
    }

    return getSaleDetailById(sale.id, tx);
  });
}

export async function getSaleDetailById(
  saleId: string,
  client: Pick<typeof prisma, "sale"> = prisma
): Promise<SaleDetail> {
  const sale = await client.sale.findUnique({
    where: { id: saleId },
    include: saleDetailInclude,
  });

  if (!sale) {
    throw new ApiError("Transaksi penjualan tidak ditemukan.", 404);
  }

  return sale;
}

export async function getSalesReport(
  period: SalesPeriodFilter,
  latestLimit = MAX_LATEST_SALES
): Promise<SalesReport> {
  const where = {
    createdAt: {
      gte: period.from,
      lte: period.to,
    },
  } satisfies Prisma.SaleWhereInput;

  const [summary, transactionCount, soldItems, latestSales] = await Promise.all([
    prisma.sale.aggregate({
      where,
      _sum: { totalAmount: true },
    }),
    prisma.sale.count({ where }),
    prisma.saleItem.aggregate({
      where: { sale: where },
      _sum: { quantity: true },
    }),
    prisma.sale.findMany({
      where,
      take: latestLimit,
      orderBy: { createdAt: "desc" },
      include: saleDetailInclude,
    }),
  ]);

  return {
    period: {
      fromInput: period.fromInput,
      toInput: period.toInput,
    },
    revenue: Number(summary._sum.totalAmount || 0),
    transactionCount,
    itemCount: soldItems._sum.quantity || 0,
    latestSales,
  };
}

function parseReportDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(`${label} harus format YYYY-MM-DD.`, 400);
  }

  const parsed = parseISO(value);

  if (!isValid(parsed)) {
    throw new ApiError(`${label} tidak valid.`, 400);
  }

  return parsed;
}

function normalizeMoneyInput(value: unknown, label: string) {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new ApiError(`${label} tidak valid.`, 400);
  }

  return Math.round(numberValue);
}

function combineDuplicateItems(items: SaleCheckoutItemInput[]) {
  const byVariant = new Map<string, SaleCheckoutItemInput>();

  for (const item of items) {
    const existing = byVariant.get(item.variantId);

    if (existing) {
      existing.quantity += item.quantity;
    } else {
      byVariant.set(item.variantId, { ...item });
    }
  }

  return [...byVariant.values()];
}

function buildReceiptNumber() {
  const timestamp = format(new Date(), "yyyyMMddHHmmss");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `POS-${timestamp}-${randomPart}`;
}
