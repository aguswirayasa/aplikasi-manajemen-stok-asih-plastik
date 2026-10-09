import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('scripts/seed-sales-demo.ts', 'utf8');
const fixture = source.slice(source.indexOf('const products ='), source.indexOf('type StockReader'));
function generate() {
  return vm.runInNewContext(ts.transpile(fixture + '\n({ products, dailySales, soldByProduct, openingStockByProduct })'));
}
const data = generate();
assert.equal(JSON.stringify(data), JSON.stringify(generate()), 'Seed harus deterministik.');
const daily = new Map();
for (const sale of data.dailySales) {
  const date = sale.timestamp.slice(0, 10);
  const total = sale.items.reduce((sum, item) => sum + data.products[item.productIndex].price * item.quantity, 0);
  daily.set(date, (daily.get(date) ?? 0) + total);
  assert.equal(new Set(sale.items.map(item => item.productIndex)).size, sale.items.length);
  assert.ok(sale.items.every(item => Number.isInteger(item.quantity) && item.quantity > 0));
  assert.ok(new Date(sale.timestamp).getTime() <= Date.now(), 'Transaksi tidak boleh berada di masa depan.');
}
const totals = [...daily.values()];
assert.ok(new Set(totals).size > totals.length * 0.7, 'Omzet harian terlalu berulang.');
assert.ok(totals.slice(3).filter((total, i) => total === totals[i]).length < totals.length * 0.15, 'Pola omzet berulang setiap tiga hari.');
const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
assert.equal([...daily.keys()].at(-1), today, 'Seed harus mencakup hari ini.');
assert.ok(data.dailySales.some(sale => sale.items.some(item => item.quantity >= 8)), 'Seed perlu pembelian grosir sesekali.');
assert.ok(data.openingStockByProduct.every((quantity, i) => quantity - data.soldByProduct[i] === 20));
console.log(`Pola seed lulus: ${daily.size} hari, ${data.dailySales.length} transaksi, ${new Set(totals).size} omzet unik.`);

const runnable = source.slice(0, source.lastIndexOf('\nmain()')) + '\nexports.main = main;';
for (const externalKind of ['sale', 'stockIn', 'stockOut']) {
  const variants = data.products.map((product, i) => ({
    id: `variant-${i}`, sku: product.sku, stock: 20,
    product: { name: product.name, category: { name: 'Audit Seed 2026' } },
  }));
  const tx = {
    productVariant: { findMany: async () => variants, findUniqueOrThrow: async () => ({ stock: 20 }) },
    sale: { findMany: async () => [] },
    saleItem: { count: async () => externalKind === 'sale' ? 1 : 0 },
    stockIn: { aggregate: async () => ({ _sum: { quantity: 20 } }), count: async () => externalKind === 'stockIn' ? 1 : 0 },
    stockOut: { aggregate: async () => ({ _sum: { quantity: 0 } }), count: async () => externalKind === 'stockOut' ? 1 : 0 },
  };
  let writes = 0;
  for (const model of Object.values(tx)) {
    for (const operation of ['create', 'update', 'updateMany', 'deleteMany', 'upsert']) {
      model[operation] = async () => { writes++; assert.fail('Data operasional tidak boleh diubah.'); };
    }
  }
  const exports = {};
  vm.runInNewContext(ts.transpileModule(runnable, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, {
    exports,
    require: name => {
      if (name === 'dotenv/config') return {};
      if (name === 'node:assert/strict') return assert;
      if (name === '../lib/prisma') return { $transaction: async fn => fn(tx) };
      throw new Error(`Import tak terduga: ${name}`);
    },
    console,
  });
  await assert.rejects(exports.main(), /SKU demo sudah dipakai operasional/);
  assert.equal(writes, 0);
}
console.log('Pengaman lulus: transaksi, stok masuk, dan stok keluar operasional membatalkan seed sebelum penulisan.');
