import { NextRequest } from "next/server";
import { apiResponse } from "@/lib/api-helpers";
import { assertTelegramCronSecret } from "@/lib/telegram/config";
import {
  sendTelegramReport,
  type TelegramReportKind,
} from "@/lib/telegram/reports";

export async function handleTelegramReportRoute(
  req: NextRequest,
  kind: TelegramReportKind
) {
  assertTelegramCronSecret(req);

  const result = await sendTelegramReport(kind);

  return apiResponse(result, 200, "Laporan Telegram selesai dikirim.");
}
