import type { Prisma } from "@/generated/prisma/client";

const stockTransactionBaseInclude = {
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
  user: {
    select: { name: true, username: true },
  },
} satisfies Prisma.StockInInclude;

export const stockInTransactionInclude = stockTransactionBaseInclude;

export const stockOutTransactionInclude = {
  ...stockTransactionBaseInclude,
  saleItem: {
    include: {
      sale: {
        select: {
          id: true,
          receiptNumber: true,
          totalAmount: true,
          paidAmount: true,
          changeAmount: true,
          createdAt: true,
        },
      },
    },
  },
} satisfies Prisma.StockOutInclude;

export type StockInTransaction = Prisma.StockInGetPayload<{
  include: typeof stockInTransactionInclude;
}>;

export type StockOutTransaction = Prisma.StockOutGetPayload<{
  include: typeof stockOutTransactionInclude;
}>;

export type MergedStockTransaction =
  | (StockInTransaction & { type: "IN" })
  | (StockOutTransaction & { type: "OUT" });

export function mergeStockTransactions(
  stockIns: StockInTransaction[],
  stockOuts: StockOutTransaction[],
  limit: number
): MergedStockTransaction[] {
  return [
    ...stockIns.map((item) => ({ ...item, type: "IN" as const })),
    ...stockOuts.map((item) => ({ ...item, type: "OUT" as const })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

// Satu baris riwayat untuk satu SKU di dalam sebuah transaksi/batch
export type StockTransactionLine = {
  id: string;
  sku: string;
  productName: string;
  variationLabel: string;
  quantity: number;
  note: string | null;
};

// Referensi penjualan yang dipakai untuk menautkan grup ke struk
export type StockTransactionSaleRef = {
  id: string;
  receiptNumber: string;
  totalAmount: number;
};

// Sekelompok baris yang berasal dari satu kali transaksi (penjualan / batch barang masuk-keluar)
export type StockTransactionGroup = {
  key: string;
  type: "IN" | "OUT";
  createdAt: Date;
  user: { name: string | null; username: string };
  note: string | null;
  totalQuantity: number;
  lineCount: number;
  lines: StockTransactionLine[];
  sale: StockTransactionSaleRef | null;
};

// Tentukan kunci pengelompokan: penjualan pakai saleId, sisanya pakai batchId, fallback id baris
function resolveGroupKey(item: MergedStockTransaction): string {
  if (item.type === "OUT" && item.saleItem) {
    return `sale:${item.saleItem.sale.id}`;
  }

  if (item.batchId) {
    return `batch:${item.type}:${item.batchId}`;
  }

  return `row:${item.type}:${item.id}`;
}

function formatVariationLabel(item: MergedStockTransaction): string {
  return (
    item.variant.values
      .map((value) => value.variationValue.value)
      .filter(Boolean)
      .join(" / ") || "-"
  );
}

function toTransactionLine(item: MergedStockTransaction): StockTransactionLine {
  return {
    id: item.id,
    sku: item.variant.sku,
    productName: item.variant.product.name,
    variationLabel: formatVariationLabel(item),
    quantity: item.quantity,
    note: item.note,
  };
}

// Kelompokkan baris-baris stok yang sudah terurut menjadi grup per transaksi
export function groupStockTransactions(
  items: MergedStockTransaction[]
): StockTransactionGroup[] {
  const groups = new Map<string, StockTransactionGroup>();

  for (const item of items) {
    const key = resolveGroupKey(item);
    const existing = groups.get(key);

    if (existing) {
      existing.lines.push(toTransactionLine(item));
      existing.totalQuantity += item.quantity;
      existing.lineCount += 1;
      // Catatan grup pakai catatan pertama yang tersedia
      if (!existing.note && item.note) {
        existing.note = item.note;
      }
      continue;
    }

    groups.set(key, {
      key,
      type: item.type,
      createdAt: item.createdAt,
      user: item.user,
      note: item.note,
      totalQuantity: item.quantity,
      lineCount: 1,
      lines: [toTransactionLine(item)],
      sale:
        item.type === "OUT" && item.saleItem
          ? {
              id: item.saleItem.sale.id,
              receiptNumber: item.saleItem.sale.receiptNumber,
              totalAmount: Number(item.saleItem.sale.totalAmount),
            }
          : null,
    });
  }

  return [...groups.values()].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}
