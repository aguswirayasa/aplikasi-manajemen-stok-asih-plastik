import { ApiError } from "@/lib/api-helpers";

export function getTelegramBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new ApiError("Konfigurasi TELEGRAM_BOT_TOKEN belum tersedia.", 500);
  }

  return token;
}

export function assertTelegramWebhookSecret(incomingSecret: string | null) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expectedSecret) {
    throw new ApiError("Konfigurasi TELEGRAM_WEBHOOK_SECRET belum tersedia.", 500);
  }

  if (incomingSecret !== expectedSecret) {
    throw new ApiError("Akses webhook Telegram ditolak.", 403);
  }
}

export function assertTelegramCronSecret(request: Request) {
  const expectedSecret = process.env.TELEGRAM_CRON_SECRET;

  if (!expectedSecret) {
    throw new ApiError("Konfigurasi TELEGRAM_CRON_SECRET belum tersedia.", 500);
  }

  const authHeader = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-telegram-cron-secret");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (headerSecret !== expectedSecret && bearerSecret !== expectedSecret) {
    throw new ApiError("Akses laporan Telegram ditolak.", 403);
  }
}

export function getTelegramLinkTtlMinutes() {
  const rawValue = Number(process.env.TELEGRAM_LINK_TTL_MINUTES || "15");

  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 15;
  }

  return Math.min(Math.round(rawValue), 120);
}
