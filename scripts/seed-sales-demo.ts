import "dotenv/config";
import assert from "node:assert/strict";
import type { Prisma } from "../generated/prisma/client";
import prisma from "../lib/prisma";

const receiptPrefix = "AUDIT-SALE-2026-";
const openingNote = "Seed penjualan audit Juli-September 2026";
const products = [
  { name: "Audit Seed Plastik Bening", sku: "AUDIT-SALES-2026-01", price: 12_000 },
  { name: "Audit Seed Plastik Klip", sku: "AUDIT-SALES-2026-02", price: 18_000 },
  { name: "Audit Seed Plastik Packing", sku: "AUDIT-SALES-2026-03", price: 25_000 },
] as const;
// Angka acak tetap membuat hasil seed dapat diperiksa dan diulang.
let randomState = 20260701;
function random() {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState / 2 ** 32;
}
const localNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
const startDate = Date.UTC(2026, 6, 1);
const dayCount = Math.floor((localNow.getTime() - startDate) / 86_400_000) + 1;
let demand = 1;
const dailySales = Array.from({ length: Math.max(0, dayCount) }, (_, dayIndex) => {
  const date = new Date(startDate + dayIndex * 86_400_000);
  const dateText = date.toISOString().slice(0, 10);
  // Permintaan berubah bertahap; akhir pekan dan gajian menambah keramaian.
  demand = Math.max(0.75, Math.min(1.3, demand * 0.85 + (0.8 + random() * 0.4) * 0.15));
  const weekend = [0, 6].includes(date.getUTCDay()) ? 1.18 : 1;
  const payday = date.getUTCDate() >= 25 || date.getUTCDate() <= 3 ? 1.15 : 1;
  const trend = 1 + Math.min(dayIndex, 180) * 0.0015;
  const count = Math.max(2, Math.round((3 + random() * 3) * demand * weekend * payday * trend));
  const closingMinute = dayIndex === dayCount - 1
    ? Math.min(17 * 60, localNow.getUTCHours() * 60 + localNow.getUTCMinutes())
    : 17 * 60;
  if (closingMinute < 9 * 60) return [];

  return Array.from({ length: count }, () => {
    const wholesale = random() < 0.08;
    const lineCount = random() < 0.45 ? 1 : random() < 0.8 ? 2 : 3;
    const available = [0, 1, 2];
    const items = Array.from({ length: lineCount }, () => {
      const productIndex = available.splice(Math.floor(random() * available.length), 1)[0];
      const quantity = wholesale ? 8 + Math.floor(random() * 8) : 1 + Math.floor(random() * 4);
      return { productIndex, quantity };
    });
    const minute = 9 * 60 + Math.floor(random() * (closingMinute - 9 * 60 + 1));
    return {
      timestamp: `${dateText}T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}:00+08:00`,
      items,
    };
  }).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}).flat();
const soldByProduct = products.map((_, productIndex) =>
  dailySales.reduce(
    (total, sale) => total + sale.items.reduce(
      (subtotal, item) => subtotal + (item.productIndex === productIndex ? item.quantity : 0),
      0
    ),
    0
  )
);
const openingStockByProduct = soldByProduct.map((quantity) => quantity + 20);
type StockReader = Pick<Prisma.TransactionClient, "productVariant" | "stockIn" | "stockOut">;

function assertSeedShape() {
  assert.ok(dailySales.length > 0, "Rentang seed belum memiliki penjualan.");
  assert.ok(dailySales.every(({ items }) =>
    items.length > 0 && new Set(items.map(({ productIndex }) => productIndex)).size === items.length &&
    items.every(({ quantity }) => Number.isInteger(quantity) && quantity > 0)
  ));
  assert.ok(openingStockByProduct.every((quantity, index) => quantity > (soldByProduct[index] ?? 0)));
}

async function assertStockReconciles(
  client: StockReader,
  variantId: string
) {
  const [variant, stockIn, stockOut] = await Promise.all([
    client.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: { stock: true },
    }),
    client.stockIn.aggregate({
      where: { variantId },
      _sum: { quantity: true },
    }),
    client.stockOut.aggregate({
      where: { variantId },
      _sum: { quantity: true },
    }),
  ]);

  assert.equal(
    variant.stock,
    (stockIn._sum.quantity ?? 0) - (stockOut._sum.quantity ?? 0),
    `Stok ${variantId} tidak sesuai seluruh riwayat barang masuk/keluar.`
  );
}

async function main() {
  assertSeedShape();

  const outcome = await prisma.$transaction(async (tx) => {
    const existingVariants = await tx.productVariant.findMany({
      where: { sku: { in: products.map(({ sku }) => sku) } },
      include: { product: { include: { category: true } } },
    });

    const receipts = await tx.sale.findMany({
      where: { receiptNumber: { startsWith: receiptPrefix } },
      include: { items: { include: { stockOut: true } } },
    });
    const variantIds = existingVariants.map(({ id }) => id);
    assert.ok(receipts.every(({ items }) => items.length > 0 && items.every((item) =>
      variantIds.includes(item.variantId) && item.stockOut?.variantId === item.variantId &&
      item.stockOut.quantity === item.quantity
    )), "Nomor nota demo bercampur dengan data lain; seed dibatalkan.");

    if (existingVariants.length > 0) {
      assert.equal(existingVariants.length, products.length, "Seed produk sudah ada sebagian.");
      for (const productData of products) {
        const variant = existingVariants.find(({ sku }) => sku === productData.sku);
        assert.ok(variant);
        assert.equal(variant.product.name, productData.name);
        assert.equal(variant.product.category.name, "Audit Seed 2026");
        await assertStockReconciles(tx, variant.id);
      }
      const externalSales = await tx.saleItem.count({
        where: { variantId: { in: variantIds }, sale: { receiptNumber: { not: { startsWith: receiptPrefix } } } },
      });
      const externalStockIn = await tx.stockIn.count({
        where: { variantId: { in: variantIds }, OR: [{ note: null }, { note: { not: openingNote } }, { batchId: null }, { batchId: { not: "audit-sales-2026-opening" } }] },
      });
      const externalStockOut = await tx.stockOut.count({
        where: { variantId: { in: variantIds }, OR: [{ saleItemId: null }, { saleItem: { sale: { receiptNumber: { not: { startsWith: receiptPrefix } } } } }] },
      });
      assert.equal(externalSales + externalStockIn + externalStockOut, 0,
        "SKU demo sudah dipakai operasional; penggantian seed dibatalkan.");

      // Hanya riwayat demo terisolasi yang diganti, seluruhnya dalam satu transaksi.
      await tx.stockOut.deleteMany({ where: { variantId: { in: variantIds } } });
      await tx.sale.deleteMany({ where: { receiptNumber: { startsWith: receiptPrefix } } });
      await tx.stockIn.deleteMany({ where: { variantId: { in: variantIds } } });
      await tx.productVariant.updateMany({ where: { id: { in: variantIds } }, data: { stock: 0 } });
    }

    const cashier = await tx.user.findFirst({
      where: { isActive: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    if (!cashier) {
      throw new Error("Seed memerlukan minimal satu pengguna aktif sebagai kasir.");
    }

    const category = await tx.category.upsert({
      where: { name: "Audit Seed 2026" },
      create: { name: "Audit Seed 2026" },
      update: {},
    });
    const variants: Array<{ id: string }> = [];
    for (const [index, productData] of products.entries()) {
      let variant: { id: string } | undefined = existingVariants.find(({ sku }) => sku === productData.sku);
      if (!variant) {
        const product = await tx.product.create({
          data: {
            name: productData.name,
            description: "Item terisolasi untuk data demo penjualan sejak Juli 2026.",
            categoryId: category.id,
            createdAt: new Date("2026-06-30T08:00:00+08:00"),
          },
        });
        variant = await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: productData.sku,
            price: productData.price,
            stock: 0,
            minStock: 0,
            createdAt: new Date("2026-06-30T08:00:00+08:00"),
          },
        });
      }
      variants.push(variant);
      await tx.productVariant.update({
        where: { id: variant.id },
        data: { stock: { increment: openingStockByProduct[index] ?? 0 } },
      });
      await tx.stockIn.create({
        data: {
          variantId: variant.id,
          quantity: openingStockByProduct[index] ?? 0,
          note: openingNote,
          batchId: "audit-sales-2026-opening",
          userId: cashier.id,
          createdAt: new Date("2026-06-30T09:00:00+08:00"),
        },
      });
    }

    for (const [index, fixtureSale] of dailySales.entries()) {
      const createdAt = new Date(fixtureSale.timestamp);
      const receiptNumber = `${receiptPrefix}${String(index + 1).padStart(3, "0")}`;
      const items = fixtureSale.items.map((item) => ({
        ...item,
        variant: variants[item.productIndex],
        price: products[item.productIndex].price,
      }));
      const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const sale = await tx.sale.create({
        data: {
          receiptNumber,
          totalAmount,
          paidAmount: totalAmount,
          changeAmount: 0,
          cashierId: cashier.id,
          createdAt,
        },
      });
      for (const item of items) {
        assert.ok(item.variant);
        const saleItem = await tx.saleItem.create({
          data: {
            saleId: sale.id,
            variantId: item.variant.id,
            quantity: item.quantity,
            unitPrice: item.price,
            subtotal: item.price * item.quantity,
            createdAt,
          },
        });
        await tx.stockOut.create({
          data: {
            variantId: item.variant.id,
            quantity: item.quantity,
            note: `Penjualan ${receiptNumber}`,
            batchId: sale.id,
            userId: cashier.id,
            saleItemId: saleItem.id,
            createdAt,
          },
        });
      }
    }

    for (const [index, variant] of variants.entries()) {
      await tx.productVariant.update({
        where: { id: variant.id },
        data: { stock: { decrement: soldByProduct[index] ?? 0 } },
      });
      await assertStockReconciles(tx, variant.id);
    }
    return existingVariants.length > 0 ? "replaced" as const : "created" as const;
  }, { maxWait: 10_000, timeout: 120_000 });

  console.log(
    `Seed ${outcome === "created" ? "dibuat" : "diperbarui"}: ${dailySales.length} penjualan sejak Juli 2026 sampai ${localNow.toISOString().slice(0, 10)}, ${products.length} SKU; masing-masing menyisakan 20 unit.`
  );
}

main()
  .catch(() => {
    console.error("Seed penjualan gagal; transaksi dibatalkan.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
