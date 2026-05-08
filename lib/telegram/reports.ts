import prisma from "@/lib/prisma";
import { getDashboardData } from "@/lib/dashboard-data";
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

const transactionDateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Singapore",
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
    return "Perlu Dicek:\n- Semua SKU aktif masih aman.";
  }

  return [
    "Perlu Dicek:",
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
  const recentTransactions =
    data.recentTransactions.length === 0
      ? ["Pergerakan terbaru:", "- Belum ada pergerakan stok terbaru."]
      : [
          "Pergerakan terbaru:",
          ...data.recentTransactions.map((transaction) => {
            const direction = transaction.type === "IN" ? "Masuk" : "Keluar";
            const signedQuantity =
              transaction.type === "IN"
                ? `+${transaction.quantity}`
                : `-${transaction.quantity}`;

            return `- ${transactionDateFormatter.format(
              transaction.createdAt
            )} ${direction} ${transaction.variant.sku} ${signedQuantity} oleh ${
              transaction.user.name || transaction.user.username
            }`;
          }),
        ];

  return [
    `${formatReportTitle(kind)} - ${generatedAt}`,
    "",
    formatActionSection(data.lowStockVariants),
    "",
    "Ringkasan hari ini:",
    `- Barang masuk hari ini: ${data.today.stockIn}`,
    `- Barang keluar hari ini: ${data.today.stockOut}`,
    `- SKU aktif: ${totals.activeSkus}`,
    `- Produk aktif: ${totals.products}`,
    `- Total stok: ${totals.totalStock}`,
    `- SKU perlu dicek: ${totals.lowStock}`,
    "",
    ...recentTransactions,
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
