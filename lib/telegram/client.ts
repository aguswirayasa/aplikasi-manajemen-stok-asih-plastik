import { getTelegramBotToken } from "@/lib/telegram/config";

type TelegramSendMessageResponse = {
  ok: boolean;
  description?: string;
};

export async function sendTelegramMessage(chatId: string, text: string) {
  const response = await fetch(
    `https://api.telegram.org/bot${getTelegramBotToken()}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | TelegramSendMessageResponse
    | null;

  if (!response.ok || payload?.ok === false) {
    throw new Error(
      payload?.description || `Telegram sendMessage gagal (${response.status}).`
    );
  }
}
