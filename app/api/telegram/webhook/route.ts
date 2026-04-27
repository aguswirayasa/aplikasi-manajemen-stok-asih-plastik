import { NextRequest } from "next/server";
import {
  ApiError,
  apiResponse,
  withErrorHandler,
} from "@/lib/api-helpers";
import { handleTelegramUpdate, isTelegramUpdate } from "@/lib/telegram/commands";
import { assertTelegramWebhookSecret } from "@/lib/telegram/config";

export const POST = withErrorHandler(async (req: NextRequest) => {
  assertTelegramWebhookSecret(
    req.headers.get("x-telegram-bot-api-secret-token")
  );

  const body = (await req.json()) as unknown;

  if (!isTelegramUpdate(body)) {
    throw new ApiError("Payload Telegram tidak valid.", 400);
  }

  const result = await handleTelegramUpdate(body);

  return apiResponse(result);
});
