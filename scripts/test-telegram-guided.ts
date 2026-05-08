import assert from "node:assert/strict";
import { parseTelegramGuidedIntent } from "@/lib/telegram/guided-parser";
import { rankTelegramVariantsForTest } from "@/lib/telegram/variant-search";

const variants = [
  {
    id: "variant-1",
    sku: "PLT-KCL-HTM-05",
    stock: 5,
    minStock: 10,
    isActive: true,
    product: { name: "Plastik HD" },
    values: [
      { variationValue: { value: "Kecil" } },
      { variationValue: { value: "Hitam" } },
      { variationValue: { value: "0.5mm" } },
    ],
  },
  {
    id: "variant-2",
    sku: "PLT-BSR-MRH-10",
    stock: 80,
    minStock: 10,
    isActive: true,
    product: { name: "Plastik HD" },
    values: [
      { variationValue: { value: "Besar" } },
      { variationValue: { value: "Merah" } },
      { variationValue: { value: "1.0mm" } },
    ],
  },
  {
    id: "variant-3",
    sku: "KRT-A4",
    stock: 50,
    minStock: 5,
    isActive: true,
    product: { name: "Kertas HVS" },
    values: [{ variationValue: { value: "A4" } }],
  },
];

assert.deepEqual(parseTelegramGuidedIntent("/stok PLT-KCL-HTM-05"), {
  kind: "lookup",
  query: "PLT-KCL-HTM-05",
  explicit: true,
});

assert.deepEqual(parseTelegramGuidedIntent("stok plastik hitam"), {
  kind: "lookup",
  query: "plastik hitam",
  explicit: true,
});

assert.deepEqual(parseTelegramGuidedIntent("keluar plastik kecil 2"), {
  kind: "stock",
  action: "stockOut",
  query: "plastik kecil",
  quantity: 2,
  note: null,
  explicit: true,
});

assert.deepEqual(parseTelegramGuidedIntent("/masuk kertas a4 10 dari supplier"), {
  kind: "stock",
  action: "stockIn",
  query: "kertas a4",
  quantity: 10,
  note: "dari supplier",
  explicit: true,
});

assert.deepEqual(parseTelegramGuidedIntent("masuk plastik hitam"), {
  kind: "stock",
  action: "stockIn",
  query: "plastik hitam",
  quantity: null,
  note: null,
  explicit: true,
});

assert.equal(
  rankTelegramVariantsForTest(variants, "PLT-KCL-HTM-05")[0].variant.id,
  "variant-1"
);

assert.equal(
  rankTelegramVariantsForTest(variants, "plastik hitam")[0].variant.id,
  "variant-1"
);

assert.equal(
  rankTelegramVariantsForTest(variants, "kertas a4")[0].variant.id,
  "variant-3"
);

assert.equal(rankTelegramVariantsForTest(variants, "tidak ada").length, 0);

console.log("Telegram guided parser/search tests passed.");
