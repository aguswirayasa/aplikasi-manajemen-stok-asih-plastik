import prisma from "@/lib/prisma";
import { getDashboardData } from "@/lib/dashboard-data";
import {
  buildSalesPeriodFilter,
  getSalesReport,
  type SalesReport,
} from "@/lib/sales";
import { formatStockCurrency } from "@/lib/stock-format";
import { sendTelegramMessage } from "@/lib/telegram/client";
import type { LinkedTelegramUser } from "@/lib/telegram/types";

export type TelegramReportKind = "opening" | "closing" | "daily";

const reportDateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Singapore",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type LowStockVariant = Awaited<
  ReturnType<typeof getDashboardData>
>["lowStockVariants"][number];

function formatVariation(values: LowStockVariant["values"]) {
  return (
    values
      .map((item) => item.variationValue.value)
      .filter(Boolean)
      .join(" / ") || "-"
  );
}

function formatActionSection(variants: LowStockVariant[]) {
  if (variants.length === 0) {
    return "SKU di bawah stok minimum:\n- Semua SKU aktif masih aman.";
  }

  return [
    "SKU di bawah stok minimum:",
    ...variants.map(
      (variant, index) =>
        `${index + 1}. ${variant.sku} - ${variant.product.name} (${formatVariation(
          variant.values
        )})\n   Stok ${variant.stock}, minimum ${variant.minStock}`
    ),
  ].join("\n");
}

function formatLowStockSection(variants: LowStockVariant[]) {
  if (variants.length === 0) {
    return "Stok minimum:\n- Semua SKU aktif masih aman.";
  }

  return [
    "Stok minimum:",
    ...variants.map(
      (variant, index) =>
        `${index + 1}. ${variant.sku} - ${variant.product.name} (${formatVariation(
          variant.values
        )})\n   Stok ${variant.stock}, minimum ${variant.minStock}`
    ),
  ].join("\n");
}

export async function buildLowStockMessage() {
  const data = await getDashboardData({ lowStockLimit: 20 });

  return formatLowStockSection(data.lowStockVariants);
}

export async function buildSalesReportMessage(from: string, to: string) {
  const report = await getSalesReport(buildSalesPeriodFilter(from, to), 5);

  return formatSalesReportSection(report, "Laporan penjualan");
}

export async function buildDailyReportMessage(kind: TelegramReportKind = "daily") {
  const data = await getDashboardData({
    includeOwnerTotals: true,
    lowStockLimit: 20,
  });
  const totals = data.totals;

  if (!totals) {
    throw new Error("Ringkasan dashboard admin tidak tersedia.");
  }

  const generatedAt = reportDateFormatter.format(new Date());

  if (kind === "opening") {
    return [
      `${formatReportTitle(kind)} - ${generatedAt}`,
      "",
      "Ringkasan status toko:",
      `- SKU aktif: ${totals.activeSkus}`,
      `- Produk aktif: ${totals.products}`,
      `- Total stok tersedia: ${totals.totalStock}`,
      `- SKU di bawah stok minimum: ${totals.lowStock}`,
      "",
      formatActionSection(data.lowStockVariants),
    ].join("\n");
  }

  const salesSection = formatSalesReportSection(
    data.salesReport,
    "Ringkasan penjualan hari ini",
    { includeLatestSales: false }
  );

  return [
    `${formatReportTitle(kind)} - ${generatedAt}`,
    "",
    salesSection,
    "",
    "Ringkasan stok hari ini:",
    `- Barang masuk hari ini: ${data.today.stockIn}`,
    `- SKU aktif: ${totals.activeSkus}`,
    `- Produk aktif: ${totals.products}`,
    `- Total stok: ${totals.totalStock}`,
    `- SKU di bawah stok minimum: ${totals.lowStock}`,
    "",
    formatActionSection(data.lowStockVariants),
  ].join("\n");
}

export async function sendTelegramReport(kind: TelegramReportKind = "daily") {
  const recipients = await prisma.user.findMany({
    where: {
      role: "ADMIN",
      isActive: true,
      telegramChatId: { not: null },
    },
    select: {
      id: true,
      telegramChatId: true,
      username: true,
      name: true,
    },
  });
  const message = await buildDailyReportMessage(kind);

  const results = await Promise.allSettled(
    recipients.map((recipient) =>
      sendTelegramMessage(recipient.telegramChatId as string, message)
    )
  );
  const failed = results.filter((result) => result.status === "rejected");

  for (const failure of failed) {
    console.error("Pengiriman laporan Telegram gagal:", failure.reason);
  }

  return {
    attempted: recipients.length,
    sent: results.length - failed.length,
    failed: failed.length,
  };
}

export async function sendDailyTelegramReport() {
  return sendTelegramReport("daily");
}

export function formatLinkedUser(user: LinkedTelegramUser) {
  return `${user.name || user.username} (${user.role})`;
}

function formatReportTitle(kind: TelegramReportKind) {
  if (kind === "opening") {
    return "Laporan Buka Toko";
  }

  if (kind === "closing") {
    return "Laporan Tutup Toko";
  }

  return "Laporan Stok";
}

function formatSalesReportSection(
  report: SalesReport | null,
  title: string,
  options: { includeLatestSales?: boolean } = {}
) {
  const includeLatestSales = options.includeLatestSales ?? true;

  if (!report) {
    return `${title}:\n- Data penjualan belum tersedia.`;
  }

  const latest =
    report.latestSales.length === 0
      ? ["- Belum ada transaksi pada periode ini."]
      : report.latestSales.map(
          (sale, index) =>
            `${index + 1}. ${sale.receiptNumber} - ${formatStockCurrency(
              Number(sale.totalAmount)
            )}`
        );

  return [
    `${title}:`,
    `- Periode: ${report.period.fromInput} s/d ${report.period.toInput}`,
    `- Omzet: ${formatStockCurrency(report.revenue)}`,
    `- Transaksi: ${report.transactionCount}`,
    `- Item terjual: ${report.itemCount}`,
    ...(includeLatestSales ? ["Transaksi terbaru:", ...latest] : []),
  ].join("\n");
}
