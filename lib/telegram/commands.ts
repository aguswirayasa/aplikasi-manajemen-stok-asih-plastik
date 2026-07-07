import { ApiError } from "@/lib/api-helpers";
import prisma from "@/lib/prisma";
import { checkoutSale, type SaleDetail } from "@/lib/sales";
import { recordStockIn } from "@/lib/stock-mutations";
import {
  clearTelegramConversationState,
  getTelegramConversationState,
  saveTelegramConversationState,
  type TelegramConversationPayload,
  type TelegramSaleCartItem,
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
  buildSalesReportMessage,
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
  "penjualan plastik kecil 2",
  "barang masuk kertas a4 10 dari supplier",
  "stok minimum",
  "laporan",
  "laporan penjualan 2026-05-01 2026-05-25",
  "",
  "Jika bot meminta pilihan, balas angka pilihan barang.",
  "Setelah item penjualan masuk, ketik item lain atau bayar untuk lanjut pembayaran.",
  "Jika bot meminta catatan, balas isi catatan atau balas - untuk melewati.",
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
    case "salesReport":
      return await buildSalesReportMessage(intent.from, intent.to);
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
    case "awaitNote":
      return await handleNoteReply(text, state, context);
    case "confirmStock":
      return await handleStockConfirmation(text, state, context);
    case "saleChoice":
      return await handleSaleChoice(text, state, context);
    case "awaitSaleQuantity":
      return await handleSaleQuantityReply(text, state, context);
    case "awaitSaleNextAction":
      return await handleSaleNextAction(text, state, context);
    case "awaitSalePayment":
      return await handleSalePaymentReply(text, state, context);
    case "confirmSale":
      return await handleSaleConfirmation(text, state, context);
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
  if (intent.action === "stockOut") {
    return await handleSaleIntent(intent, context);
  }

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

  return await askNoteOrConfirmation(context, {
    action: intent.action,
    variant,
    quantity: intent.quantity,
    note: intent.note,
  });
}

async function handleSaleIntent(
  intent: Extract<TelegramGuidedIntent, { kind: "stock" }>,
  context: ActionReplyContext,
  cart: TelegramSaleCartItem[] = []
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
      kind: "saleChoice",
      variants: matches.map((match) => match.variant),
      quantity: intent.quantity,
      cart,
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
    return await askSaleQuantity(context, variant, cart);
  }

  return await addSaleItemAndAskNext(context, cart, variant, intent.quantity);
}

async function handleSaleChoice(
  text: string,
  state: Extract<TelegramConversationPayload, { kind: "saleChoice" }>,
  context: ActionReplyContext
) {
  const variant = pickVariantFromChoices(text, state.variants);

  if (!variant) {
    return "Balas dengan angka yang ada di daftar barang, atau ketik batal.";
  }

  if (!state.quantity) {
    return await askSaleQuantity(context, variant, state.cart);
  }

  return await addSaleItemAndAskNext(
    context,
    state.cart,
    variant,
    state.quantity
  );
}

async function handleSaleQuantityReply(
  text: string,
  state: Extract<TelegramConversationPayload, { kind: "awaitSaleQuantity" }>,
  context: ActionReplyContext
) {
  const quantity = parsePositiveInteger(text);

  if (!quantity) {
    return "Jumlah harus angka lebih dari 0. Contoh: 2. Balas jumlah barang, atau ketik batal.";
  }

  return await addSaleItemAndAskNext(
    context,
    state.cart,
    state.variant,
    quantity
  );
}

async function handleSaleNextAction(
  text: string,
  state: Extract<TelegramConversationPayload, { kind: "awaitSaleNextAction" }>,
  context: ActionReplyContext
) {
  if (isSalePaymentText(text)) {
    return await askSalePayment(context, state.cart);
  }

  const intent = parseTelegramGuidedIntent(`penjualan ${text}`);

  if (intent.kind !== "stock" || intent.action !== "stockOut") {
    return "Ketik nama atau kode item lain, atau ketik bayar untuk lanjut pembayaran.";
  }

  return await handleSaleIntent(intent, context, state.cart);
}

async function handleSalePaymentReply(
  text: string,
  state: Extract<TelegramConversationPayload, { kind: "awaitSalePayment" }>,
  context: ActionReplyContext
) {
  const paidAmount = parseMoneyAmount(text);

  if (paidAmount === null) {
    return "Nominal bayar harus angka. Contoh: 50000. Ketik batal untuk membatalkan.";
  }

  const summary = await validateSaleCart(state.cart);

  if (paidAmount < summary.totalAmount) {
    await saveTelegramConversationState(context.chatId, context.user.id, state);
    return [
      `Uang dibayar kurang dari total transaksi ${formatCurrency(summary.totalAmount)}.`,
      "Balas nominal pembayaran yang cukup, atau ketik batal.",
    ].join("\n");
  }

  await saveTelegramConversationState(context.chatId, context.user.id, {
    kind: "confirmSale",
    cart: state.cart,
    paidAmount,
  });

  return [
    "Periksa dulu sebelum penjualan disimpan:",
    formatSaleCartSummary(summary),
    `Bayar: ${formatCurrency(paidAmount)}`,
    `Kembalian: ${formatCurrency(paidAmount - summary.totalAmount)}`,
    "",
    "Jika sudah benar, balas ya. Jika salah, ketik batal.",
  ].join("\n");
}

async function handleSaleConfirmation(
  text: string,
  state: Extract<TelegramConversationPayload, { kind: "confirmSale" }>,
  context: ActionReplyContext
) {
  if (!isConfirmText(text)) {
    return "Balas ya kalau data sudah benar dan ingin disimpan. Ketik batal untuk membatalkan.";
  }

  const summary = await validateSaleCart(state.cart);

  if (state.paidAmount < summary.totalAmount) {
    return await askSalePaymentAfterError(context, {
      cart: state.cart,
      message: `Total penjualan berubah menjadi ${formatCurrency(summary.totalAmount)}. Nominal bayar sebelumnya kurang.`,
    });
  }

  const sale = await checkoutSale(context.user.id, {
    items: summary.items.map((item) => ({
      variantId: item.variant.id,
      quantity: item.quantity,
    })),
    paidAmount: state.paidAmount,
  });

  await clearTelegramConversationState(context.chatId);

  return formatSaleSuccessMessage(sale);
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

  const stockError = await getStockQuantityError(
    state.action,
    variant,
    state.quantity
  );

  if (stockError) {
    return await askQuantityAfterStockError(context, {
      action: state.action,
      variant,
      note: state.note,
      message: stockError,
    });
  }

  return await askNoteOrConfirmation(context, {
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

  const stockError = await getStockQuantityError(
    state.action,
    state.variant,
    quantity
  );

  if (stockError) {
    return [
      stockError,
      "Balas jumlah barang yang sesuai stok tersedia, atau ketik batal.",
    ].join("\n");
  }

  return await askNoteOrConfirmation(context, {
    action: state.action,
    variant: state.variant,
    quantity,
    note: state.note,
  });
}

async function handleNoteReply(
  text: string,
  state: Extract<TelegramConversationPayload, { kind: "awaitNote" }>,
  context: ActionReplyContext
) {
  return await askStockConfirmation(context, {
    kind: "confirmStock",
    action: state.action,
    variant: state.variant,
    quantity: state.quantity,
    note: parseOptionalNoteReply(text),
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

  await clearTelegramConversationState(context.chatId);
  return "Flow barang keluar sudah diganti menjadi penjualan. Ketik penjualan nama barang jumlah untuk mencatat transaksi.";
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

async function askSaleQuantity(
  context: ActionReplyContext,
  variant: TelegramVariantSnapshot,
  cart: TelegramSaleCartItem[]
) {
  await saveTelegramConversationState(context.chatId, context.user.id, {
    kind: "awaitSaleQuantity",
    variant,
    cart,
  });

  return [
    "Penjualan untuk barang ini:",
    formatVariantLine(variant),
    "Balas jumlah barangnya. Contoh: 2. Ketik batal untuk membatalkan.",
  ].join("\n");
}

async function addSaleItemAndAskNext(
  context: ActionReplyContext,
  cart: TelegramSaleCartItem[],
  variant: TelegramVariantSnapshot,
  quantity: number
) {
  const nextCart = combineSaleCartItems([...cart, { variant, quantity }]);
  const summary = await validateSaleCart(nextCart);

  await saveTelegramConversationState(context.chatId, context.user.id, {
    kind: "awaitSaleNextAction",
    cart: nextCart,
  });

  return [
    "Item penjualan sudah masuk cart.",
    formatSaleCartSummary(summary),
    "",
    "Ketik nama atau kode item lain untuk menambah barang.",
    "Ketik bayar atau lanjut untuk masuk tahap pembayaran.",
    "Ketik batal untuk membatalkan.",
  ].join("\n");
}

async function askSalePayment(
  context: ActionReplyContext,
  cart: TelegramSaleCartItem[]
) {
  const summary = await validateSaleCart(cart);

  await saveTelegramConversationState(context.chatId, context.user.id, {
    kind: "awaitSalePayment",
    cart,
  });

  return [
    "Masukkan nominal uang dibayar.",
    formatSaleCartSummary(summary),
    `Total: ${formatCurrency(summary.totalAmount)}`,
    "Contoh: 50000. Ketik batal untuk membatalkan.",
  ].join("\n");
}

async function askSalePaymentAfterError(
  context: ActionReplyContext,
  payload: {
    cart: TelegramSaleCartItem[];
    message: string;
  }
) {
  await saveTelegramConversationState(context.chatId, context.user.id, {
    kind: "awaitSalePayment",
    cart: payload.cart,
  });

  return [
    payload.message,
    "Balas nominal pembayaran yang cukup, atau ketik batal.",
  ].join("\n");
}

async function askNoteOrConfirmation(
  context: ActionReplyContext,
  payload: {
    action: TelegramStockAction;
    variant: TelegramVariantSnapshot;
    quantity: number;
    note: string | null;
  }
) {
  const stockError = await getStockQuantityError(
    payload.action,
    payload.variant,
    payload.quantity
  );

  if (stockError) {
    throw new ApiError(stockError, 409);
  }

  if (payload.note) {
    return await askStockConfirmation(context, {
      kind: "confirmStock",
      ...payload,
    });
  }

  return await askNote(context, payload);
}

async function askNote(
  context: ActionReplyContext,
  payload: {
    action: TelegramStockAction;
    variant: TelegramVariantSnapshot;
    quantity: number;
  }
) {
  await saveTelegramConversationState(context.chatId, context.user.id, {
    kind: "awaitNote",
    ...payload,
  });

  return [
    "Tambahkan catatan jika perlu.",
    "Contoh: dari supplier.",
    "Jika tidak ada, balas - atau lewati.",
    "Ketik batal untuk membatalkan.",
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

async function askQuantityAfterStockError(
  context: ActionReplyContext,
  payload: {
    action: TelegramStockAction;
    variant: TelegramVariantSnapshot;
    note: string | null;
    message: string;
  }
) {
  await saveTelegramConversationState(context.chatId, context.user.id, {
    kind: "awaitQuantity",
    action: payload.action,
    variant: payload.variant,
    note: payload.note,
  });

  return [
    payload.message,
    "Balas jumlah barang yang sesuai stok tersedia, atau ketik batal.",
  ].join("\n");
}

async function getStockQuantityError(
  action: TelegramStockAction,
  variant: TelegramVariantSnapshot,
  quantity: number
) {
  if (action !== "stockOut") {
    return null;
  }

  const latestVariant = await prisma.productVariant.findUnique({
    where: { id: variant.id },
    select: {
      sku: true,
      stock: true,
      isActive: true,
      product: { select: { isArchived: true } },
    },
  });

  if (!latestVariant) {
    return "SKU tidak ditemukan.";
  }

  if (!latestVariant.isActive) {
    return "SKU tidak aktif dan tidak bisa dikeluarkan.";
  }

  if (latestVariant.product.isArchived) {
    return "Produk yang sudah diarsipkan tidak bisa dikeluarkan.";
  }

  if (latestVariant.stock < quantity) {
    return `Stok ${latestVariant.sku} tidak cukup. Tersedia ${latestVariant.stock}, diminta ${quantity}.`;
  }

  return null;
}

type ValidatedSaleCartItem = TelegramSaleCartItem & {
  unitPrice: number;
  subtotal: number;
};

type ValidatedSaleCart = {
  items: ValidatedSaleCartItem[];
  totalAmount: number;
};

async function validateSaleCart(
  cart: TelegramSaleCartItem[]
): Promise<ValidatedSaleCart> {
  const combinedCart = combineSaleCartItems(cart);

  if (combinedCart.length === 0) {
    throw new ApiError("Tambahkan minimal satu item penjualan.", 400);
  }

  const variantIds = combinedCart.map((item) => item.variant.id);
  const latestVariants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      sku: true,
      price: true,
      stock: true,
      isActive: true,
      product: { select: { isArchived: true } },
    },
  });
  const latestById = new Map(
    latestVariants.map((variant) => [variant.id, variant])
  );

  const items = combinedCart.map((item) => {
    const latest = latestById.get(item.variant.id);

    if (!latest) {
      throw new ApiError(`SKU ${item.variant.sku} tidak ditemukan.`, 404);
    }

    if (!latest.isActive) {
      throw new ApiError(`SKU ${latest.sku} tidak aktif.`, 409);
    }

    if (latest.product.isArchived) {
      throw new ApiError(`Produk untuk SKU ${latest.sku} sudah diarsipkan.`, 409);
    }

    if (latest.stock < item.quantity) {
      throw new ApiError(
        `Stok ${latest.sku} tidak cukup. Tersedia ${latest.stock}, diminta ${item.quantity}.`,
        409
      );
    }

    const unitPrice = Number(latest.price);

    return {
      ...item,
      variant: {
        ...item.variant,
        sku: latest.sku,
        stock: latest.stock,
      },
      unitPrice,
      subtotal: unitPrice * item.quantity,
    };
  });

  return {
    items,
    totalAmount: items.reduce((total, item) => total + item.subtotal, 0),
  };
}

function combineSaleCartItems(cart: TelegramSaleCartItem[]) {
  const byVariant = new Map<string, TelegramSaleCartItem>();

  for (const item of cart) {
    const existing = byVariant.get(item.variant.id);

    if (existing) {
      existing.quantity += item.quantity;
    } else {
      byVariant.set(item.variant.id, {
        variant: item.variant,
        quantity: item.quantity,
      });
    }
  }

  return [...byVariant.values()];
}

function formatSaleCartSummary(summary: ValidatedSaleCart) {
  return [
    "Cart penjualan:",
    ...summary.items.map(
      (item, index) =>
        `${index + 1}. ${item.variant.sku} - ${item.variant.productName} (${item.variant.variation}) x${item.quantity} = ${formatCurrency(item.subtotal)}`
    ),
    `Total: ${formatCurrency(summary.totalAmount)}`,
  ].join("\n");
}

function formatSaleSuccessMessage(sale: SaleDetail) {
  const totalAmount = Number(sale.totalAmount);
  const paidAmount = Number(sale.paidAmount);
  const changeAmount = Number(sale.changeAmount);

  return [
    "Penjualan berhasil disimpan.",
    `No. struk: ${sale.receiptNumber}`,
    "",
    "Item:",
    ...sale.items.map(
      (item, index) =>
        `${index + 1}. ${item.variant.sku} - ${item.variant.product.name} (${formatSaleItemVariation(item.variant.values)}) x${item.quantity} = ${formatCurrency(Number(item.subtotal))}`
    ),
    "",
    `Total: ${formatCurrency(totalAmount)}`,
    `Bayar: ${formatCurrency(paidAmount)}`,
    `Kembalian: ${formatCurrency(changeAmount)}`,
  ].join("\n");
}

function formatSaleItemVariation(
  values: SaleDetail["items"][number]["variant"]["values"]
) {
  return (
    values
      .map((item) => item.variationValue.value)
      .filter(Boolean)
      .join(" / ") || "-"
  );
}

function isSalePaymentText(text: string) {
  return ["bayar", "pembayaran", "lanjut", "checkout"].includes(
    normalizeReplyText(text)
  );
}

function parseMoneyAmount(text: string) {
  const normalized = text.trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const value = Number(normalized);

  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
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
  return action === "stockIn" ? "Barang masuk" : "Penjualan";
}

function parseOptionalNoteReply(text: string) {
  const normalized = normalizeReplyText(text);

  if (
    normalized === "-" ||
    normalized === "lewati" ||
    normalized === "skip" ||
    normalized === "tanpa catatan"
  ) {
    return null;
  }

  return text.trim() || null;
}

function buildTelegramNote(note: string | null) {
  return note ? `Telegram: ${note}` : "Telegram";
}

function normalizeReplyText(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
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
