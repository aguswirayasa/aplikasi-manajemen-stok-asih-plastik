import { ApiError } from "@/lib/api-helpers";

export type StockItemInput = {
  variantId: string;
  quantity: number;
};

type StockItemBody = {
  items?: StockItemInput[];
  variantId?: string;
  quantity?: number;
};

export function parseStockItems(body: StockItemBody, quantityLabel: string) {
  const items = Array.isArray(body.items)
    ? body.items
    : body.variantId && body.quantity
      ? [{ variantId: body.variantId, quantity: body.quantity }]
      : [];

  if (items.length === 0) {
    throw new ApiError("Tambahkan minimal satu SKU.", 400);
  }

  for (const item of items) {
    if (
      !item.variantId ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      throw new ApiError(
        `Setiap SKU harus punya jumlah ${quantityLabel} yang valid.`,
        400
      );
    }
  }

  return items;
}

export function parseOptionalStockNote(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ApiError("Catatan tidak valid.", 400);
  }

  const note = value.trim();

  return note.length > 0 ? note : null;
}
