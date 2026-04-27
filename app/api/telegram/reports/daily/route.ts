import { NextRequest } from "next/server";
import { apiResponse, withErrorHandler } from "@/lib/api-helpers";
import { assertTelegramCronSecret } from "@/lib/telegram/config";
import { sendDailyTelegramReport } from "@/lib/telegram/reports";

export const POST = withErrorHandler(async (req: NextRequest) => {
  assertTelegramCronSecret(req);

  const result = await sendDailyTelegramReport();

  return apiResponse(result, 200, "Laporan Telegram selesai dikirim.");
});
