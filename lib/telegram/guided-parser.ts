import type { TelegramStockAction } from "@/lib/telegram/conversation-state";

export type TelegramGuidedIntent =
  | { kind: "help"; explicit: boolean }
  | { kind: "link"; token: string | null; explicit: boolean }
  | { kind: "logout"; explicit: boolean }
  | { kind: "me"; explicit: boolean }
  | { kind: "lowstock"; explicit: boolean }
  | { kind: "report"; explicit: boolean }
  | { kind: "lookup"; query: string | null; explicit: boolean }
  | {
      kind: "stock";
      action: TelegramStockAction;
      query: string | null;
      quantity: number | null;
      note: string | null;
      explicit: boolean;
    };

const stockOutTriggers = [
  "stok keluar",
  "stock keluar",
  "barang keluar",
  "keluar",
  "stockout",
  "jual",
  "terjual",
];

const stockInTriggers = [
  "stok masuk",
  "stock masuk",
  "barang masuk",
  "masuk",
  "stockin",
  "restock",
  "tambah stok",
];

const lookupTriggers = ["cek stok", "cari stok", "lihat stok", "stok", "stock", "sku"];

export function parseTelegramGuidedIntent(text: string): TelegramGuidedIntent {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return { kind: "help", explicit: false };
  }

  const [rawCommand = "", ...parts] = trimmed.split(/\s+/);
  const isSlashCommand = rawCommand.startsWith("/");

  if (isSlashCommand) {
    const command = rawCommand.replace(/^\//, "").split("@")[0].toLowerCase();
    const rest = parts.join(" ").trim();

    switch (command) {
      case "start":
      case "help":
      case "bantuan":
        return { kind: "help", explicit: true };
      case "link":
        return { kind: "link", token: parts[0] ?? null, explicit: true };
      case "logout":
      case "unlink":
        return { kind: "logout", explicit: true };
      case "me":
      case "akun":
        return { kind: "me", explicit: true };
      case "lowstock":
      case "minimum":
        return { kind: "lowstock", explicit: true };
      case "report":
      case "laporan":
        return { kind: "report", explicit: true };
      case "stok":
      case "stock":
      case "sku":
        return { kind: "lookup", query: rest || null, explicit: true };
      case "keluar":
      case "stockout":
        return parseStockIntent("stockOut", rest, true);
      case "masuk":
      case "stockin":
        return parseStockIntent("stockIn", rest, true);
      default:
        return { kind: "help", explicit: true };
    }
  }

  const normalized = normalizeText(trimmed);

  if (normalized === "help" || normalized === "bantuan") {
    return { kind: "help", explicit: true };
  }

  if (normalized === "laporan" || normalized === "report") {
    return { kind: "report", explicit: true };
  }

  if (
    normalized === "stok minimum" ||
    normalized === "stock minimum" ||
    normalized === "lowstock" ||
    normalized === "low stock" ||
    normalized === "minimum"
  ) {
    return { kind: "lowstock", explicit: true };
  }

  const stockOutBody = stripTrigger(trimmed, normalized, stockOutTriggers);

  if (stockOutBody !== null) {
    return parseStockIntent("stockOut", stockOutBody, true);
  }

  const stockInBody = stripTrigger(trimmed, normalized, stockInTriggers);

  if (stockInBody !== null) {
    return parseStockIntent("stockIn", stockInBody, true);
  }

  const lookupBody = stripTrigger(trimmed, normalized, lookupTriggers);

  if (lookupBody !== null) {
    return {
      kind: "lookup",
      query: lookupBody.trim() || null,
      explicit: true,
    };
  }

  return {
    kind: "lookup",
    query: trimmed,
    explicit: false,
  };
}

export function isCancelText(text: string) {
  return ["batal", "cancel", "tidak", "nggak", "ga", "gak"].includes(
    normalizeText(text)
  );
}

export function isConfirmText(text: string) {
  return ["ya", "iya", "yes", "ok", "oke", "lanjut", "konfirmasi"].includes(
    normalizeText(text)
  );
}

export function parsePositiveInteger(text: string) {
  const normalized = text.trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const value = Number(normalized);

  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function parseStockIntent(
  action: TelegramStockAction,
  body: string,
  explicit: boolean
): Extract<TelegramGuidedIntent, { kind: "stock" }> {
  const parsed = parseStockBody(body);

  return {
    kind: "stock",
    action,
    query: parsed.query,
    quantity: parsed.quantity,
    note: parsed.note,
    explicit,
  };
}

function parseStockBody(body: string) {
  const noteSplit = splitNote(body);
  const tokens = noteSplit.body.trim().split(/\s+/).filter(Boolean);
  const quantityIndex = tokens.findIndex((token) => /^\d+$/.test(token));

  if (quantityIndex === -1) {
    return {
      query: noteSplit.body.trim() || null,
      quantity: null,
      note: noteSplit.note,
    };
  }

  const quantity = Number(tokens[quantityIndex]);
  const beforeQuantity = tokens.slice(0, quantityIndex).join(" ").trim();
  const afterQuantity = tokens.slice(quantityIndex + 1).join(" ").trim();
  const query = beforeQuantity || afterQuantity || null;
  const inlineNote = beforeQuantity ? afterQuantity : "";
  const note = [inlineNote, noteSplit.note].filter(Boolean).join(" ").trim();

  return {
    query,
    quantity: Number.isSafeInteger(quantity) && quantity > 0 ? quantity : null,
    note: note || null,
  };
}

function splitNote(body: string) {
  const match = body.match(/\b(?:catatan|note|ket|keterangan)\b[:\s-]*(.*)$/i);

  if (!match || match.index === undefined || match.index < 0) {
    return { body, note: null };
  }

  return {
    body: body.slice(0, match.index).trim(),
    note: match[1]?.trim() || null,
  };
}

function stripTrigger(
  original: string,
  normalized: string,
  triggers: string[]
) {
  for (const trigger of triggers) {
    if (normalized === trigger) {
      return "";
    }

    if (normalized.startsWith(`${trigger} `)) {
      return original.slice(trigger.length).trim();
    }
  }

  return null;
}

function normalizeText(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}
