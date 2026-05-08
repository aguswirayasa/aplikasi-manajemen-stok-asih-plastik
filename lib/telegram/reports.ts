import prisma from "@/lib/prisma";
import { getDashboardData } from "@/lib/dashboard-data";
import { sendTelegramMessage } from "@/lib/telegram/client";
import type { LinkedTelegramUser } from "@/lib/telegram/types";

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
  const data = await getDashboardData();

  return formatLowStockSection(data.lowStockVariants);
}

export async function buildDailyReportMessage() {
  const data = await getDashboardData({ includeOwnerTotals: true });
  const totals = data.totals;

  if (!totals) {
    throw new Error("Ringkasan dashboard admin tidak tersedia.");
  }

  const generatedAt = reportDateFormatter.format(new Date());
  const recentTransactions =
    data.recentTransactions.length === 0
      ? ["Transaksi terbaru:", "- Belum ada transaksi terbaru."]
      : [
          "Transaksi terbaru:",
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
    `Laporan Stok - ${generatedAt}`,
    "",
    "Ringkasan:",
    `- Produk: ${totals.products}`,
    `- SKU aktif: ${totals.activeSkus}`,
    `- Total stok: ${totals.totalStock}`,
    `- Stok rendah: ${totals.lowStock}`,
    `- Barang masuk hari ini: ${data.today.stockIn}`,
    `- Barang keluar hari ini: ${data.today.stockOut}`,
    "",
    formatLowStockSection(data.lowStockVariants),
    "",
    ...recentTransactions,
  ].join("\n");
}

export async function sendDailyTelegramReport() {
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
  const message = await buildDailyReportMessage();

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

export function formatLinkedUser(user: LinkedTelegramUser) {
  return `${user.name || user.username} (${user.role})`;
}
