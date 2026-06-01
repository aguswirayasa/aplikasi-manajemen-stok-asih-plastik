// Modul server-only: query Prisma untuk riwayat stok.
// Jangan diimpor dari komponen "use client"; gunakan stock-history-utils untuk utilitas murni.

import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-helpers";
import prisma from "@/lib/prisma";
import {
  groupStockTransactions,
  mergeStockTransactions,
  stockInTransactionInclude,
  stockOutTransactionInclude,
} from "@/lib/stock-transactions";

// Re-export semua utilitas murni agar server caller tidak perlu mengubah import
export {
  buildStockHistoryQuery,
  getStockHistoryPeriodLabel,
  getStockHistoryTypeLabel,
  STOCK_HISTORY_PAGE_SIZE,
  STOCK_HISTORY_REPORT_LIMIT,
  STOCK_HISTORY_TYPES,
} from "@/lib/stock-history-utils";
export type {
  StockHistoryFilter,
  StockHistoryPagination,
  StockHistoryResult,
  StockHistorySearchInput,
  StockHistorySummary,
  StockHistoryType,
} from "@/lib/stock-history-utils";

import type {
  StockHistoryFilter,
  StockHistorySearchInput,
  StockHistoryResult,
  StockHistorySummary,
} from "@/lib/stock-history-utils";
import {
  parseStockHistoryFilter as parseStockHistoryFilterInput,
  StockHistoryFilterError,
} from "@/lib/stock-history-utils";

type StockHistoryQueryMode = "page" | "report";

export function parseStockHistoryFilter(
  input: StockHistorySearchInput,
  options: { mode?: StockHistoryQueryMode } = {}
): StockHistoryFilter {
  try {
    return parseStockHistoryFilterInput(input, options);
  } catch (error: unknown) {
    if (error instanceof StockHistoryFilterError) {
      throw new ApiError(error.message, error.status);
    }

    throw error;
  }
}

export async function getStockHistory(
  filter: StockHistoryFilter,
  options: { mode?: StockHistoryQueryMode } = {}
): Promise<StockHistoryResult> {
  const mode = options.mode || "page";
  const dateWhere = buildDateWhere(filter);
  const stockInWhere = { ...dateWhere } satisfies Prisma.StockInWhereInput;
  const stockOutWhere = buildStockOutWhere(filter, dateWhere);
  const includeStockIns = filter.type !== "sales";
  const includeStockOuts = filter.type !== "in";

  // Ambil header grup: satu entri per transaksi/batch, dipakai untuk paginasi berbasis transaksi
  const [
    stockInBatchHeaders,
    stockOutBatchHeaders,
    stockInRowHeaders,
    stockOutRowHeaders,
  ] = await Promise.all([
    includeStockIns
      ? prisma.stockIn.groupBy({
          by: ["batchId"],
          where: { ...stockInWhere, batchId: { not: null } },
          _max: { createdAt: true },
        })
      : [],
    includeStockOuts
      ? prisma.stockOut.groupBy({
          by: ["batchId"],
          where: { ...stockOutWhere, batchId: { not: null } },
          _max: { createdAt: true },
        })
      : [],
    includeStockIns
      ? prisma.stockIn.findMany({
          where: { ...stockInWhere, batchId: null },
          select: { id: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        })
      : [],
    includeStockOuts
      ? prisma.stockOut.findMany({
          where: { ...stockOutWhere, batchId: null },
          select: { id: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        })
      : [],
  ]);

  const headers: TransactionHeader[] = [
    ...stockInBatchHeaders.map((header) => toBatchHeader("IN", header)),
    ...stockOutBatchHeaders.map((header) => toBatchHeader("OUT", header)),
    ...stockInRowHeaders.map((header) => toRowHeader("IN", header)),
    ...stockOutRowHeaders.map((header) => toRowHeader("OUT", header)),
  ]
    .filter((header): header is TransactionHeader => header !== null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const totalItems = headers.length;
  const totalPages = Math.max(Math.ceil(totalItems / filter.pageSize), 1);
  const page = mode === "report" ? 1 : Math.min(filter.page, totalPages);
  const startIndex = mode === "report" ? 0 : (page - 1) * filter.pageSize;
  const pageHeaders = headers.slice(startIndex, startIndex + filter.pageSize);
  const inBatchIds = pageHeaders
    .filter(
      (header): header is Extract<TransactionHeader, { mode: "batch" }> =>
        header.type === "IN" && header.mode === "batch"
    )
    .map((header) => header.batchId);
  const outBatchIds = pageHeaders
    .filter(
      (header): header is Extract<TransactionHeader, { mode: "batch" }> =>
        header.type === "OUT" && header.mode === "batch"
    )
    .map((header) => header.batchId);
  const inRowIds = pageHeaders
    .filter(
      (header): header is Extract<TransactionHeader, { mode: "row" }> =>
        header.type === "IN" && header.mode === "row"
    )
    .map((header) => header.rowId);
  const outRowIds = pageHeaders
    .filter(
      (header): header is Extract<TransactionHeader, { mode: "row" }> =>
        header.type === "OUT" && header.mode === "row"
    )
    .map((header) => header.rowId);

  const [stockIns, stockOuts, summary] = await Promise.all([
    inBatchIds.length || inRowIds.length
      ? prisma.stockIn.findMany({
          where: {
            ...stockInWhere,
            OR: [
              ...(inBatchIds.length ? [{ batchId: { in: inBatchIds } }] : []),
              ...(inRowIds.length ? [{ id: { in: inRowIds } }] : []),
            ],
          },
          orderBy: { createdAt: "desc" },
          include: stockInTransactionInclude,
        })
      : [],
    outBatchIds.length || outRowIds.length
      ? prisma.stockOut.findMany({
          where: {
            ...stockOutWhere,
            OR: [
              ...(outBatchIds.length ? [{ batchId: { in: outBatchIds } }] : []),
              ...(outRowIds.length ? [{ id: { in: outRowIds } }] : []),
            ],
          },
          orderBy: { createdAt: "desc" },
          include: stockOutTransactionInclude,
        })
      : [],
    buildStockHistorySummary(filter, stockInWhere, stockOutWhere, totalItems),
  ]);
  const merged = mergeStockTransactions(
    stockIns,
    stockOuts,
    stockIns.length + stockOuts.length
  );
  const history = groupStockTransactions(merged);

  return {
    filter: { ...filter, page },
    history,
    pagination: {
      page,
      pageSize: filter.pageSize,
      totalItems,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
    summary,
  };
}

type TransactionHeader =
  | {
      type: "IN" | "OUT";
      mode: "batch";
      batchId: string;
      createdAt: Date;
    }
  | {
      type: "IN" | "OUT";
      mode: "row";
      rowId: string;
      createdAt: Date;
    };

function toBatchHeader(
  type: "IN" | "OUT",
  header: { batchId: string | null; _max: { createdAt: Date | null } }
): TransactionHeader | null {
  if (!header.batchId || !header._max.createdAt) {
    return null;
  }

  return {
    type,
    mode: "batch",
    batchId: header.batchId,
    createdAt: header._max.createdAt,
  };
}

function toRowHeader(
  type: "IN" | "OUT",
  header: { id: string; createdAt: Date }
): TransactionHeader {
  return { type, mode: "row", rowId: header.id, createdAt: header.createdAt };
}

function buildDateWhere(filter: StockHistoryFilter) {
  if (!filter.from && !filter.to) {
    return {};
  }

  return {
    createdAt: {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    },
  };
}

function buildStockOutWhere(
  filter: StockHistoryFilter,
  dateWhere: Prisma.StockOutWhereInput
) {
  return {
    ...dateWhere,
    ...(filter.type === "sales" ? { saleItemId: { not: null } } : {}),
  } satisfies Prisma.StockOutWhereInput;
}

async function buildStockHistorySummary(
  filter: StockHistoryFilter,
  stockInWhere: Prisma.StockInWhereInput,
  stockOutWhere: Prisma.StockOutWhereInput,
  totalRows: number
): Promise<StockHistorySummary> {
  const includeStockIns = filter.type !== "sales";
  const includeStockOuts = filter.type !== "in";
  const salesWhere = buildSalesWhere(filter);

  const [
    stockInQuantity,
    salesQuantity,
    salesRevenue,
    stockInByVariant,
    stockOutByVariant,
  ] = await Promise.all([
    includeStockIns
      ? prisma.stockIn.aggregate({
          where: stockInWhere,
          _sum: { quantity: true },
        })
      : null,
    includeStockOuts
      ? prisma.stockOut.aggregate({
          where: {
            ...stockOutWhere,
            saleItemId: { not: null },
          },
          _sum: { quantity: true },
        })
      : null,
    includeStockOuts
      ? prisma.sale.aggregate({
          where: salesWhere,
          _sum: { totalAmount: true },
        })
      : null,
    includeStockIns
      ? prisma.stockIn.groupBy({
          by: ["variantId"],
          where: stockInWhere,
          _sum: { quantity: true },
        })
      : [],
    includeStockOuts
      ? prisma.stockOut.groupBy({
          by: ["variantId"],
          where: stockOutWhere,
          _sum: { quantity: true },
        })
      : [],
  ]);
  const quantityByVariant = new Map<string, number>();

  for (const item of stockInByVariant) {
    quantityByVariant.set(item.variantId, item._sum.quantity || 0);
  }

  for (const item of stockOutByVariant) {
    quantityByVariant.set(
      item.variantId,
      (quantityByVariant.get(item.variantId) || 0) + (item._sum.quantity || 0)
    );
  }

  const [topVariantId, topQuantity] = [...quantityByVariant.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0] || [null, 0];
  const topVariant = topVariantId
    ? await prisma.productVariant.findUnique({
        where: { id: topVariantId },
        select: { sku: true, product: { select: { name: true } } },
      })
    : null;

  return {
    totalRows,
    totalStockInQuantity: stockInQuantity?._sum.quantity || 0,
    totalSalesQuantity: salesQuantity?._sum.quantity || 0,
    salesRevenue: Number(salesRevenue?._sum.totalAmount || 0),
    uniqueSkuCount: quantityByVariant.size,
    topSku:
      topVariant && topVariantId
        ? {
            sku: topVariant.sku,
            productName: topVariant.product.name,
            quantity: topQuantity,
          }
        : null,
  };
}

function buildSalesWhere(filter: StockHistoryFilter) {
  return {
    ...(filter.from || filter.to
      ? {
          createdAt: {
            ...(filter.from ? { gte: filter.from } : {}),
            ...(filter.to ? { lte: filter.to } : {}),
          },
        }
      : {}),
  } satisfies Prisma.SaleWhereInput;
}
