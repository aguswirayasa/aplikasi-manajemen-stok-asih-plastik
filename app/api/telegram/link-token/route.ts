import { apiResponse, requireAuth, withErrorHandler } from "@/lib/api-helpers";
import {
  createTelegramLinkToken,
  getTelegramLinkStatus,
  unlinkTelegramUser,
} from "@/lib/telegram/linking";

export const GET = withErrorHandler(async () => {
  const user = await requireAuth();
  const status = await getTelegramLinkStatus(user.id);

  return apiResponse(status);
});

export const POST = withErrorHandler(async () => {
  const user = await requireAuth();
  const status = await getTelegramLinkStatus(user.id);
  const token = await createTelegramLinkToken(user.id);

  return apiResponse({
    ...status,
    ...token,
  });
});

export const DELETE = withErrorHandler(async () => {
  const user = await requireAuth();

  await unlinkTelegramUser(user.id);

  return apiResponse(
    {
      linked: false,
      telegramUsername: null,
      telegramLinkedAt: null,
    },
    200,
    "Telegram berhasil diputus."
  );
});
