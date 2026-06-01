// Modul utilitas murni untuk riwayat stok, tanpa impor Prisma atau modul server-only.
// Aman dipakai di komponen klien ("use client").

import { endOfDay, format, isValid, parseISO, startOfDay } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import type { StockTransactionGroup } from "@/lib/stock-transactions";

export class StockHistoryFilterError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "StockHistoryFilterError";
    this.status = status;
  }
}

const HISTORY_TIMEZONE = "Asia/Singapore";
export const STOCK_HISTORY_PAGE_SIZE = 50;
export const STOCK_HISTORY_REPORT_LIMIT = 1000;

export const STOCK_HISTORY_TYPES = ["all", "in", "sales"] as const;

export type StockHistoryType = (typeof STOCK_HISTORY_TYPES)[number];

export type StockHistoryFilter = {
  type: StockHistoryType;
  from?: Date;
  to?: Date;
  fromInput: string;
  toInput: string;
  page: number;
  pageSize: number;
};

export type StockHistoryPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type StockHistorySummary = {
  totalRows: number;
  totalStockInQuantity: number;
  totalSalesQuantity: number;
  salesRevenue: number;
  uniqueSkuCount: number;
  topSku: {
    sku: string;
    productName: string;
    quantity: number;
  } | null;
};

export type StockHistoryResult = {
  filter: StockHistoryFilter;
  history: StockTransactionGroup[];
  pagination: StockHistoryPagination;
  summary: StockHistorySummary;
};

export type StockHistorySearchInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

type StockHistoryQueryMode = "page" | "report";

export function parseStockHistoryFilter(
  input: StockHistorySearchInput,
  options: { mode?: StockHistoryQueryMode } = {}
): StockHistoryFilter {
  const mode = options.mode || "page";
  const type = parseHistoryType(readParam(input, "type"));
  const fromInput = readParam(input, "from");
  const toInput = readParam(input, "to");
  const pageSize =
    mode === "report"
      ? STOCK_HISTORY_REPORT_LIMIT
      : parsePositiveInteger(
          readParam(input, "pageSize"),
          "Jumlah data per halaman",
          STOCK_HISTORY_PAGE_SIZE
        );
  const page =
    mode === "report"
      ? 1
      : parsePositiveInteger(readParam(input, "page"), "Halaman", 1);

  const fromDate = fromInput
    ? parseHistoryDate(fromInput, "Tanggal awal")
    : undefined;
  const toDate = toInput ? parseHistoryDate(toInput, "Tanggal akhir") : undefined;

  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    throw new StockHistoryFilterError(
      "Tanggal awal tidak boleh melewati tanggal akhir.",
      400
    );
  }

  return {
    type,
    from: fromDate
      ? fromZonedTime(startOfDay(fromDate), HISTORY_TIMEZONE)
      : undefined,
    to: toDate ? fromZonedTime(endOfDay(toDate), HISTORY_TIMEZONE) : undefined,
    fromInput: fromInput || "",
    toInput: toInput || "",
    page,
    pageSize:
      mode === "report"
        ? STOCK_HISTORY_REPORT_LIMIT
        : Math.min(Math.max(pageSize, 1), STOCK_HISTORY_PAGE_SIZE),
  };
}

export function buildStockHistoryQuery(
  filter: Pick<StockHistoryFilter, "type" | "fromInput" | "toInput">,
  options: { page?: number; includePage?: boolean } = {}
) {
  const params = new URLSearchParams();

  if (filter.type !== "all") {
    params.set("type", filter.type);
  }

  if (filter.fromInput) {
    params.set("from", filter.fromInput);
  }

  if (filter.toInput) {
    params.set("to", filter.toInput);
  }

  if (options.includePage && options.page && options.page > 1) {
    params.set("page", String(options.page));
  }

  const query = params.toString();

  return query ? `?${query}` : "";
}

export function getStockHistoryTypeLabel(type: StockHistoryType) {
  switch (type) {
    case "in":
      return "Barang Masuk";
    case "sales":
      return "Transaksi";
    default:
      return "Semua";
  }
}

export function getStockHistoryPeriodLabel(filter: StockHistoryFilter) {
  if (filter.fromInput && filter.toInput) {
    return `${filter.fromInput} s/d ${filter.toInput}`;
  }

  if (filter.fromInput) {
    return `Mulai ${filter.fromInput}`;
  }

  if (filter.toInput) {
    return `Sampai ${filter.toInput}`;
  }

  return "Semua waktu";
}

function readParam(input: StockHistorySearchInput, key: string) {
  const value =
    input instanceof URLSearchParams ? input.get(key) : input[key];

  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

function parseHistoryType(value: string): StockHistoryType {
  if (!value) {
    return "all";
  }

  if (STOCK_HISTORY_TYPES.includes(value as StockHistoryType)) {
    return value as StockHistoryType;
  }

  throw new StockHistoryFilterError("Tipe riwayat tidak valid.", 400);
}

function parsePositiveInteger(value: string, label: string, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new StockHistoryFilterError(
      `${label} harus berupa angka lebih dari 0.`,
      400
    );
  }

  return parsed;
}

function parseHistoryDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new StockHistoryFilterError(`${label} harus format YYYY-MM-DD.`, 400);
  }

  const parsed = parseISO(value);

  if (!isValid(parsed) || format(parsed, "yyyy-MM-dd") !== value) {
    throw new StockHistoryFilterError(`${label} tidak valid.`, 400);
  }

  return parsed;
}
