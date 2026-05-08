import { ApiError } from "@/lib/api-helpers";
import { recordStockIn, recordStockOut } from "@/lib/stock-mutations";
import {
  clearTelegramConversationState,
  getTelegramConversationState,
  saveTelegramConversationState,
  type TelegramConversationPayload,
  type TelegramStockAction,
  type TelegramVariantSnapshot,
} from "@/lib/telegram/conversation-state";
import {
  isCancelText,
  isConfirmText,
  parsePositiveInteger,
  parseTelegramGuidedIntent,
  type TelegramGuidedIntent,
} from "@/lib/telegram/guided-parser";
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
import {
  searchTelegramVariants,
  type TelegramVariantSearchResult,
} from "@/lib/telegram/variant-search";
import type {
  LinkedTelegramUser,
  TelegramMessage,
  TelegramUpdate,
} from "@/lib/telegram/types";

const helpMessage = [
  "Saya bisa membantu cek dan catat stok lewat chat.",
  "",
  "Yang bisa Anda ketik:",
  "cek stok plastik hitam",
  "barang keluar plastik kecil 2",
  "barang masuk kertas a4 10 dari supplier",
  "stok minimum",
  "laporan",
  "",
  "Jika bot meminta pilihan, balas angka pilihan barang.",
  "Jika bot meminta konfirmasi, balas ya untuk menyimpan atau batal untuk berhenti.",
  "",
  "Untuk menyambungkan pertama kali, buat kode dari halaman Telegram di aplikasi stok, lalu kirim teks yang muncul ke chat ini.",
  "",
  "Teks khusus yang tetap bisa dipakai:",
  "/me - lihat akun yang terhubung",
  "/logout - putuskan koneksi Telegram",
].join("\n");

type ActionReplyContext = {
  chatId: string;
  user: LinkedTelegramUser;
};

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
  const reply = await buildTelegramReply(text, message, chatId);

  await safeReply(chatId, reply);

  return { handled: true };
}

async function buildTelegramReply(
  text: string,
  message: TelegramMessage,
  chatId: string
) {
  try {
    const intent = parseTelegramGuidedIntent(text);

    if (intent.kind === "link") {
      return await handleLinkCommand(intent.token, message);
    }

    if (intent.kind === "logout") {
      await clearTelegramConversationState(chatId);
      const user = await unlinkTelegramChat(chatId);

      return user
        ? "Koneksi Telegram berhasil diputus. Chat ini tidak lagi terhubung ke aplikasi stok."
        : "Chat ini belum terhubung ke aplikasi stok.";
    }

    if (intent.kind === "help") {
      return helpMessage;
    }

    const user = await requireLinkedTelegramUser(chatId);
    assertAdmin(user);

    if (!intent.explicit) {
      const pendingReply = await handlePendingConversation(text, {
        chatId,
        user,
      });

      if (pendingReply) {
        return pendingReply;
      }
    }

    await clearTelegramConversationState(chatId);

    return await handleFreshIntent(intent, { chatId, user });
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return error.message;
    }

    console.error("Perintah Telegram gagal:", error);
    return "Maaf, pesan belum bisa diproses. Coba ketik bantuan untuk melihat contoh.";
  }
}

async function handleFreshIntent(
  intent: TelegramGuidedIntent,
  context: ActionReplyContext
) {
  switch (intent.kind) {
    case "me":
      return `Chat ini terhubung ke akun ${formatLinkedUser(context.user)}.`;
    case "lowstock":
      return await buildLowStockMessage();
    case "report":
      return await buildDailyReportMessage();
    case "lookup":
      return await handleLookupIntent(intent.query, context);
    case "stock":
      return await handleStockIntent(intent, context);
    default:
      return helpMessage;
  }
}

async function handlePendingConversation(
  text: string,
  context: ActionReplyContext
) {
  if (isCancelText(text)) {
    await clearTelegramConversationState(context.chatId);
    return "Baik, proses dibatalkan. Tidak ada stok yang berubah.";
  }

  const state = await getTelegramConversationState(context.chatId);

  if (!state) {
    return null;
  }

  switch (state.kind) {
    case "lookupChoice":
      return await handleLookupChoice(text, state, context);
    case "stockChoice":
      return await handleStockChoice(text, state, context);
    case "awaitQuantity":
      return await handleQuantityReply(text, state, context);
    case "confirmStock":
      return await handleStockConfirmation(text, state, context);
    default:
      return null;
  }
}

async function handleLinkCommand(token: string | null, message: TelegramMessage) {
  if (!token) {
    throw new ApiError(
      [
        "Kode hubungkan belum terbaca.",
        "Buka halaman Telegram di aplikasi stok, tekan Buat Kode Hubungkan, salin teks yang muncul, lalu kirim ke chat ini.",
        "Contoh teksnya seperti: /link ABC123",
      ].join("\n"),
      400
    );
  }

  const user = await linkTelegramChat(token, message);

  return [
    `Berhasil. Telegram sekarang terhubung ke akun ${formatLinkedUser(user)}.`,
    "Mulai sekarang Anda bisa cek stok lewat chat ini.",
    "Ketik bantuan untuk melihat contoh pesan.",
  ].join("\n");
}

async function handleLookupIntent(
  query: string | null,
  context: ActionReplyContext
) {
  if (!query) {
    throw new ApiError(
      "Ketik nama atau kode barang yang ingin dicek. Contoh: cek stok plastik hitam.",
      400
    );
  }

  const matches = await searchTelegramVariants(query);

  if (matches.length === 0) {
    return formatNoMatchMessage(query);
  }

  if (shouldOpenVariantDirectly(matches)) {
    await clearTelegramConversationState(context.chatId);
    return formatVariantDetail(matches[0].variant);
  }

  await saveTelegramConversationState(context.chatId, context.user.id, {
    kind: "lookupChoice",
    variants: matches.map((match) => match.variant),
  });

  return [
    `Saya menemukan ${matches.length} pilihan untuk "${query}".`,
    "Balas angka barang yang ingin dilihat, atau ketik batal.",
    "",
    formatVariantChoices(matches.map((match) => match.variant)),
  ].join("\n");
}

async function handleStockIntent(
  intent: Extract<TelegramGuidedIntent, { kind: "stock" }>,
  context: ActionReplyContext
) {
  if (!intent.query) {
    return formatStockUsage(intent.action);
  }

  const matches = await searchTelegramVariants(intent.query);

  if (matches.length === 0) {
    return formatNoMatchMessage(intent.query);
  }

  if (!shouldOpenVariantDirectly(matches)) {
    await saveTelegramConversationState(context.chatId, context.user.id, {
      kind: "stockChoice",
      action: intent.action,
      variants: matches.map((match) => match.variant),
      quantity: intent.quantity,
      note: intent.note,
    });

    return [
      `Saya menemukan ${matches.length} pilihan untuk "${intent.query}".`,
      "Balas angka barang yang benar, atau ketik batal.",
      "",
      formatVariantChoices(matches.map((match) => match.variant)),
    ].join("\n");
  }

  const variant = matches[0].variant;

  if (!intent.quantity) {
    return await askQuantity(context, intent.action, variant, intent.note);
  }

  return await askStockConfirmation(context, {
    kind: "confirmStock",
    action: intent.action,
    variant,
    quantity: intent.quantity,
    note: intent.note,
  });
}

async function handleLookupChoice(
  text: string,
  state: Extract<TelegramConversationPayload, { kind: "lookupChoice" }>,
  context: ActionReplyContext
) {
  const variant = pickVariantFromChoices(text, state.variants);

  if (!variant) {
    return "Balas dengan angka yang ada di daftar barang, atau ketik batal.";
  }

  await clearTelegramConversationState(context.chatId);
  return formatVariantDetail(variant);
}

async function handleStockChoice(
  text: string,
  state: Extract<TelegramConversationPayload, { kind: "stockChoice" }>,
  context: ActionReplyContext
) {
  const variant = pickVariantFromChoices(text, state.variants);

  if (!variant) {
    return "Balas dengan angka yang ada di daftar barang, atau ketik batal.";
  }

  if (!state.quantity) {
    return await askQuantity(context, state.action, variant, state.note);
  }

  return await askStockConfirmation(context, {
    kind: "confirmStock",
    action: state.action,
    variant,
    quantity: state.quantity,
    note: state.note,
  });
}

async function handleQuantityReply(
  text: string,
  state: Extract<TelegramConversationPayload, { kind: "awaitQuantity" }>,
  context: ActionReplyContext
) {
  const quantity = parsePositiveInteger(text);

  if (!quantity) {
    return "Jumlah harus angka lebih dari 0. Contoh: 2. Balas jumlah barang, atau ketik batal.";
  }

  return await askStockConfirmation(context, {
    kind: "confirmStock",
    action: state.action,
    variant: state.variant,
    quantity,
    note: state.note,
  });
}

async function handleStockConfirmation(
  text: string,
  state: Extract<TelegramConversationPayload, { kind: "confirmStock" }>,
  context: ActionReplyContext
) {
  if (!isConfirmText(text)) {
    return "Balas ya kalau data sudah benar dan ingin disimpan. Ketik batal untuk membatalkan.";
  }

  await clearTelegramConversationState(context.chatId);

  if (state.action === "stockIn") {
    const [stockIn] = await recordStockIn(
      context.user.id,
      [{ variantId: state.variant.id, quantity: state.quantity }],
      buildTelegramNote(state.note)
    );

    return `Berhasil disimpan. Stok masuk ${stockIn.variant.sku}: +${stockIn.quantity}.`;
  }

  const [stockOut] = await recordStockOut(
    context.user.id,
    [{ variantId: state.variant.id, quantity: state.quantity }],
    buildTelegramNote(state.note)
  );

  return `Berhasil disimpan. Stok keluar ${stockOut.variant.sku}: -${stockOut.quantity}.`;
}

async function askQuantity(
  context: ActionReplyContext,
  action: TelegramStockAction,
  variant: TelegramVariantSnapshot,
  note: string | null
) {
  await saveTelegramConversationState(context.chatId, context.user.id, {
    kind: "awaitQuantity",
    action,
    variant,
    note,
  });

  return [
    `${formatActionLabel(action)} untuk barang ini:`,
    formatVariantLine(variant),
    "Balas jumlah barangnya. Contoh: 2. Ketik batal untuk membatalkan.",
  ].join("\n");
}

async function askStockConfirmation(
  context: ActionReplyContext,
  payload: Extract<TelegramConversationPayload, { kind: "confirmStock" }>
) {
  await saveTelegramConversationState(context.chatId, context.user.id, payload);

  return [
    "Periksa dulu sebelum disimpan:",
    `Kegiatan: ${formatActionLabel(payload.action)}`,
    `Kode barang: ${payload.variant.sku}`,
    `Nama barang: ${payload.variant.productName}`,
    `Pilihan: ${payload.variant.variation}`,
    `Jumlah: ${payload.quantity}`,
    `Catatan: ${payload.note || "-"}`,
    "",
    "Jika sudah benar, balas ya. Jika salah, ketik batal.",
  ].join("\n");
}

function pickVariantFromChoices(
  text: string,
  variants: TelegramVariantSnapshot[]
) {
  const choice = parsePositiveInteger(text);

  if (!choice || choice > variants.length) {
    return null;
  }

  return variants[choice - 1];
}

function shouldOpenVariantDirectly(matches: TelegramVariantSearchResult[]) {
  return matches.length === 1 || matches[0].exactSku;
}

function formatVariantDetail(variant: TelegramVariantSnapshot) {
  return [
    `Kode barang: ${variant.sku}`,
    `Nama barang: ${variant.productName}`,
    `Pilihan: ${variant.variation}`,
    `Stok sekarang: ${variant.stock}`,
    `Batas minimum: ${variant.minStock}`,
    `Status barang: ${variant.isActive ? "Aktif" : "Tidak aktif"}`,
  ].join("\n");
}

function formatVariantChoices(variants: TelegramVariantSnapshot[]) {
  return variants
    .map((variant, index) => `${index + 1}. ${formatVariantLine(variant)}`)
    .join("\n");
}

function formatVariantLine(variant: TelegramVariantSnapshot) {
  return `${variant.productName} (${variant.variation}) - kode ${variant.sku}, stok ${variant.stock}, minimum ${variant.minStock}`;
}

function formatNoMatchMessage(query: string) {
  return [
    `Saya tidak menemukan barang untuk "${query}".`,
    "Coba ketik nama barang yang lebih lengkap atau kode barang. Contoh: cek stok plastik hitam.",
  ].join("\n");
}

function formatStockUsage(action: TelegramStockAction) {
  const example =
    action === "stockIn"
      ? "barang masuk plastik kecil 5 dari supplier"
      : "barang keluar plastik kecil 2";

  return [
    "Tolong tulis nama atau kode barang dan jumlahnya.",
    `Contoh: ${example}`,
  ].join("\n");
}

function formatActionLabel(action: TelegramStockAction) {
  return action === "stockIn" ? "Barang masuk" : "Barang keluar";
}

function buildTelegramNote(note: string | null) {
  return note ? `Telegram: ${note}` : "Telegram";
}

async function requireLinkedTelegramUser(chatId: string) {
  const user = await findUserByTelegramChat(chatId);

  if (!user) {
    throw new ApiError(
      [
        "Chat ini belum terhubung ke aplikasi stok.",
        "Buka aplikasi stok, masuk ke halaman Telegram, tekan Buat Kode Hubungkan, lalu kirim teks yang muncul ke chat ini.",
      ].join("\n"),
      401
    );
  }

  if (!user.isActive) {
    throw new ApiError("Akun aplikasi stok ini sedang tidak aktif.", 403);
  }

  return user;
}

function assertAdmin(user: LinkedTelegramUser) {
  if (user.role !== "ADMIN") {
    throw new ApiError(
      "Pesan ini hanya bisa dipakai oleh admin toko. Minta admin untuk membantu jika perlu mencatat stok atau melihat laporan.",
      403
    );
  }
}

async function safeReply(chatId: string, text: string) {
  try {
    await sendTelegramMessage(chatId, text);
  } catch (error: unknown) {
    console.error("Balasan Telegram gagal:", error);
  }
}
