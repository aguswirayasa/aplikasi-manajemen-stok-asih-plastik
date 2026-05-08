import { ApiError } from "@/lib/api-helpers";
import prisma from "@/lib/prisma";
import { recordStockIn, recordStockOut } from "@/lib/stock-mutations";
import { sendTelegramMessage } from "@/lib/telegram/client";
import {
  findUserByTelegramChat,
  linkTelegramChat,
  normalizeTelegramChatId,
  unlinkTelegramChat,
} from "@/lib/telegram/linking";
import {
  buildDailyReportMessage,
  buildLowStockMessage,
  formatLinkedUser,
} from "@/lib/telegram/reports";
import type {
  LinkedTelegramUser,
  TelegramMessage,
  TelegramUpdate,
} from "@/lib/telegram/types";

type ParsedCommand =
  | { kind: "help" }
  | { kind: "link"; token: string | null }
  | { kind: "logout" }
  | { kind: "me" }
  | { kind: "lowstock" }
  | { kind: "report" }
  | { kind: "lookup"; sku: string | null }
  | { kind: "stockIn"; sku: string | null; quantity: number | null; note: string | null }
  | { kind: "stockOut"; sku: string | null; quantity: number | null; note: string | null };

const helpMessage = [
  "Perintah Telegram Stock System:",
  "/link KODE - hubungkan akun dari webapp",
  "/me - lihat akun yang terhubung",
  "/stok SKU - cek stok SKU",
  "/lowstock - lihat stok minimum",
  "/keluar SKU JUMLAH [catatan] - catat stok keluar",
  "/masuk SKU JUMLAH [catatan] - catat stok masuk admin",
  "/report - laporan ringkas admin",
  "/logout - putuskan akun Telegram",
].join("\n");

export function isTelegramUpdate(value: unknown): value is TelegramUpdate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const update = value as { update_id?: unknown; message?: unknown };

  if (typeof update.update_id !== "number") {
    return false;
  }

  if (update.message === undefined) {
    return true;
  }

  if (!update.message || typeof update.message !== "object") {
    return false;
  }

  const message = update.message as {
    message_id?: unknown;
    chat?: { id?: unknown; type?: unknown };
    text?: unknown;
  };

  return (
    typeof message.message_id === "number" &&
    Boolean(message.chat) &&
    (typeof message.chat?.id === "number" ||
      typeof message.chat?.id === "string") &&
    typeof message.chat?.type === "string" &&
    (message.text === undefined || typeof message.text === "string")
  );
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  const message = update.message;
  const text = message?.text;

  if (!message || !text) {
    return { handled: false };
  }

  const chatId = normalizeTelegramChatId(message.chat.id);
  const command = parseCommand(text);
  const reply = await buildCommandReply(command, message, chatId);

  await safeReply(chatId, reply);

  return { handled: true };
}

async function buildCommandReply(
  command: ParsedCommand,
  message: TelegramMessage,
  chatId: string
) {
  try {
    if (command.kind === "link") {
      return await handleLinkCommand(command.token, message);
    }

    if (command.kind === "logout") {
      const user = await unlinkTelegramChat(chatId);

      return user
        ? "Akun Telegram berhasil diputus dari webapp."
        : "Chat ini belum terhubung ke akun webapp.";
    }

    if (command.kind === "help") {
      return helpMessage;
    }

    const user = await requireLinkedTelegramUser(chatId);
    assertAdmin(user);

    switch (command.kind) {
      case "me":
        return `Terhubung sebagai ${formatLinkedUser(user)}.`;
      case "lowstock":
        return await buildLowStockMessage();
      case "report":
        return await buildDailyReportMessage();
      case "lookup":
        return await handleLookupCommand(command.sku);
      case "stockIn":
        return await handleStockInCommand(user, command);
      case "stockOut":
        return await handleStockOutCommand(user, command);
      default:
        return helpMessage;
    }
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return error.message;
    }

    console.error("Perintah Telegram gagal:", error);
    return "Perintah gagal diproses. Coba lagi atau cek webapp.";
  }
}

async function handleLinkCommand(token: string | null, message: TelegramMessage) {
  if (!token) {
    throw new ApiError("Gunakan format /link KODE.", 400);
  }

  const user = await linkTelegramChat(token, message);

  return `Akun Telegram berhasil terhubung sebagai ${formatLinkedUser(user)}.`;
}

async function handleLookupCommand(sku: string | null) {
  if (!sku) {
    throw new ApiError("Gunakan format /stok SKU.", 400);
  }

  const variant = await findVariantBySku(sku);

  return [
    `${variant.sku} - ${variant.product.name}`,
    `Stok: ${variant.stock}`,
    `Minimum: ${variant.minStock}`,
    `Status: ${variant.isActive ? "Aktif" : "Tidak aktif"}`,
  ].join("\n");
}

async function handleStockInCommand(
  user: LinkedTelegramUser,
  command: Extract<ParsedCommand, { kind: "stockIn" }>
) {
  const { sku, quantity, note } = validateStockCommand(command, "masuk");
  const variant = await findVariantBySku(sku);
  const [stockIn] = await recordStockIn(user.id, [{ variantId: variant.id, quantity }], buildTelegramNote(note));

  return `Stok masuk dicatat: ${stockIn.variant.sku} +${stockIn.quantity}. Stok terbaru diproses di webapp.`;
}

async function handleStockOutCommand(
  user: LinkedTelegramUser,
  command: Extract<ParsedCommand, { kind: "stockOut" }>
) {
  const { sku, quantity, note } = validateStockCommand(command, "keluar");
  const variant = await findVariantBySku(sku);
  const [stockOut] = await recordStockOut(user.id, [{ variantId: variant.id, quantity }], buildTelegramNote(note));

  return `Stok keluar dicatat: ${stockOut.variant.sku} -${stockOut.quantity}. Stok terbaru diproses di webapp.`;
}

function parseCommand(text: string): ParsedCommand {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return { kind: "help" };
  }

  const [rawCommand = "", ...parts] = trimmed.split(/\s+/);
  const command = rawCommand
    .replace(/^\//, "")
    .split("@")[0]
    .toLowerCase();

  switch (command) {
    case "start":
    case "help":
    case "bantuan":
      return { kind: "help" };
    case "link":
      return { kind: "link", token: parts[0] ?? null };
    case "logout":
    case "unlink":
      return { kind: "logout" };
    case "me":
    case "akun":
      return { kind: "me" };
    case "lowstock":
    case "minimum":
      return { kind: "lowstock" };
    case "report":
    case "laporan":
      return { kind: "report" };
    case "stok":
    case "stock":
    case "sku":
      return { kind: "lookup", sku: parts[0] ?? null };
    case "masuk":
    case "stockin":
      return parseStockCommand("stockIn", parts);
    case "keluar":
    case "stockout":
      return parseStockCommand("stockOut", parts);
    default:
      return { kind: "help" };
  }
}

function parseStockCommand(
  kind: "stockIn" | "stockOut",
  parts: string[]
): Extract<ParsedCommand, { kind: typeof kind }> {
  const quantity = Number(parts[1]);
  const note = parts.slice(2).join(" ").trim();

  return {
    kind,
    sku: parts[0] ?? null,
    quantity: Number.isInteger(quantity) ? quantity : null,
    note: note.length > 0 ? note : null,
  } as Extract<ParsedCommand, { kind: typeof kind }>;
}

function validateStockCommand(
  command: Extract<ParsedCommand, { kind: "stockIn" | "stockOut" }>,
  label: string
) {
  if (!command.sku || !command.quantity || command.quantity <= 0) {
    throw new ApiError(`Gunakan format /${label} SKU JUMLAH [catatan].`, 400);
  }

  return {
    sku: command.sku,
    quantity: command.quantity,
    note: command.note,
  };
}

function buildTelegramNote(note: string | null) {
  return note ? `Telegram: ${note}` : "Telegram";
}

async function findVariantBySku(sku: string) {
  const variant = await prisma.productVariant.findFirst({
    where: {
      sku: sku.trim(),
      product: { is: { isArchived: false } },
    },
    include: {
      product: true,
    },
  });

  if (!variant) {
    throw new ApiError("SKU tidak ditemukan.", 404);
  }

  return variant;
}

async function requireLinkedTelegramUser(chatId: string) {
  const user = await findUserByTelegramChat(chatId);

  if (!user) {
    throw new ApiError(
      "Chat ini belum terhubung. Login webapp lalu buat kode Telegram, kemudian kirim /link KODE.",
      401
    );
  }

  if (!user.isActive) {
    throw new ApiError("Akun webapp tidak aktif.", 403);
  }

  return user;
}

function assertAdmin(user: LinkedTelegramUser) {
  if (user.role !== "ADMIN") {
    throw new ApiError("Perintah ini hanya untuk admin.", 403);
  }
}

async function safeReply(chatId: string, text: string) {
  try {
    await sendTelegramMessage(chatId, text);
  } catch (error: unknown) {
    console.error("Balasan Telegram gagal:", error);
  }
}
