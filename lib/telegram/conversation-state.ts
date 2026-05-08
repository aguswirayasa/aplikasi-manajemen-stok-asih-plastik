import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";

const STATE_TTL_MINUTES = 15;

type JsonRecord = {
  [key: string]: Prisma.JsonValue | undefined;
};

export type TelegramStockAction = "stockIn" | "stockOut";

export type TelegramVariantSnapshot = {
  id: string;
  sku: string;
  productName: string;
  variation: string;
  stock: number;
  minStock: number;
  isActive: boolean;
};

export type TelegramConversationPayload =
  | {
      kind: "lookupChoice";
      variants: TelegramVariantSnapshot[];
    }
  | {
      kind: "stockChoice";
      action: TelegramStockAction;
      variants: TelegramVariantSnapshot[];
      quantity: number | null;
      note: string | null;
    }
  | {
      kind: "awaitQuantity";
      action: TelegramStockAction;
      variant: TelegramVariantSnapshot;
      note: string | null;
    }
  | {
      kind: "confirmStock";
      action: TelegramStockAction;
      variant: TelegramVariantSnapshot;
      quantity: number;
      note: string | null;
    };

export async function getTelegramConversationState(chatId: string) {
  await deleteExpiredTelegramConversationStates();

  const state = await prisma.telegramConversationState.findUnique({
    where: { chatId },
  });

  if (!state) {
    return null;
  }

  const payload = parseConversationPayload(state.kind, state.payload);

  if (!payload) {
    await clearTelegramConversationState(chatId);
    return null;
  }

  return payload;
}

export async function saveTelegramConversationState(
  chatId: string,
  userId: string,
  payload: TelegramConversationPayload
) {
  const expiresAt = new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1000);

  await prisma.telegramConversationState.upsert({
    where: { chatId },
    create: {
      chatId,
      userId,
      kind: payload.kind,
      payload: payload as unknown as Prisma.InputJsonValue,
      expiresAt,
    },
    update: {
      userId,
      kind: payload.kind,
      payload: payload as unknown as Prisma.InputJsonValue,
      expiresAt,
    },
  });
}

export async function clearTelegramConversationState(chatId: string) {
  await prisma.telegramConversationState.deleteMany({
    where: { chatId },
  });
}

async function deleteExpiredTelegramConversationStates() {
  await prisma.telegramConversationState.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
}

function parseConversationPayload(
  kind: string,
  payload: Prisma.JsonValue
): TelegramConversationPayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const data = payload as JsonRecord;

  if (kind === "lookupChoice" && hasVariantArray(data)) {
    return {
      kind,
      variants: data.variants,
    };
  }

  if (
    kind === "stockChoice" &&
    hasStockAction(data) &&
    hasVariantArray(data) &&
    hasNullableQuantity(data) &&
    hasNullableNote(data)
  ) {
    return {
      kind,
      action: data.action,
      variants: data.variants,
      quantity: data.quantity,
      note: data.note,
    };
  }

  if (
    kind === "awaitQuantity" &&
    hasStockAction(data) &&
    hasVariant(data.variant) &&
    hasNullableNote(data)
  ) {
    return {
      kind,
      action: data.action,
      variant: data.variant,
      note: data.note,
    };
  }

  if (
    kind === "confirmStock" &&
    hasStockAction(data) &&
    hasVariant(data.variant) &&
    typeof data.quantity === "number" &&
    data.quantity > 0 &&
    Number.isInteger(data.quantity) &&
    hasNullableNote(data)
  ) {
    return {
      kind,
      action: data.action,
      variant: data.variant,
      quantity: data.quantity,
      note: data.note,
    };
  }

  return null;
}

function hasStockAction(
  payload: JsonRecord
): payload is JsonRecord & {
  action: TelegramStockAction;
} {
  return payload.action === "stockIn" || payload.action === "stockOut";
}

function hasNullableQuantity(
  payload: JsonRecord
): payload is JsonRecord & {
  quantity: number | null;
} {
  return (
    payload.quantity === null ||
    (typeof payload.quantity === "number" &&
      payload.quantity > 0 &&
      Number.isInteger(payload.quantity))
  );
}

function hasNullableNote(
  payload: JsonRecord
): payload is JsonRecord & {
  note: string | null;
} {
  return payload.note === null || typeof payload.note === "string";
}

function hasVariantArray(
  payload: JsonRecord
): payload is JsonRecord & {
  variants: TelegramVariantSnapshot[];
} {
  return Array.isArray(payload.variants) && payload.variants.every(hasVariant);
}

function hasVariant(
  value: Prisma.JsonValue | undefined
): value is TelegramVariantSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.sku === "string" &&
    typeof value.productName === "string" &&
    typeof value.variation === "string" &&
    typeof value.stock === "number" &&
    typeof value.minStock === "number" &&
    typeof value.isActive === "boolean"
  );
}
