import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');

// Jalankan helper dan handler asli tanpa mengubah ekspor komponen produksi.
function loadForm(file) {
  const source = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const chunks = [];
  const callbacks = new Set(['normalizeVariantNumber', 'normalizeSingleVariantNumber', 'normalizeBulkDraftNumber', 'applyBulkDraft', 'handleSave']);
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && !['ProductWizard', 'ProductEditForm'].includes(node.name.text)) {
      chunks.push(node.getText(ast).replace(/^export /, ''));
      return;
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (callbacks.has(node.name.text) || ['EMPTY_VARIANT_DRAFT', 'INITIAL_STOCK_NOTE', 'PRODUCT_EDIT_STOCK_NOTE'].includes(node.name.text)) {
        chunks.push(`const ${node.getText(ast)};`);
        if (node.name.text !== 'handleSave') return;
      }
      if (node.name.text === 'body' && file.endsWith('ProductWizard.tsx')) {
        chunks.push(`function creationPayload() { return ${node.initializer.getText(ast)}; }`);
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const compiled = ts.transpileModule(chunks.join('\n'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = vm.createContext({ require, exports: {}, crypto: require('node:crypto').webcrypto, ApiError: class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }, generateSkuString: (name, values) => [name, ...values].join('-'), toast: { error() {}, success() {} } });
  vm.runInContext(compiled, context, { filename: file });
  return { context, run: (expression) => vm.runInContext(expression, context) };
}

const wizard = loadForm('components/products/ProductWizard.tsx');
const edit = loadForm('components/products/ProductEditForm.tsx');
const drafts = { price: '1250.50', stock: '0', minStock: '0' };
const combinations = [
  { key: 'red|small', valueIds: ['red', 'small'] },
  { key: 'red|large', valueIds: ['red', 'large'] },
  { key: 'blue|small', valueIds: ['blue', 'small'] },
];

for (const [name, form] of [['wizard', wizard], ['edit', edit]]) {
  test(`${name}: stock controls are constrained number inputs; price remains text`, () => {
    form.context.props = { ariaLabel: 'Stok', value: '0', onChange() {}, onBlur() {} };
    const input = form.run('NumericInput(props)');
    assert.equal(input.props.type, 'number');
    assert.equal(input.props.min, 0);
    assert.equal(input.props.step, 1);
    assert.equal(input.props.max, 2147483647);
    let changed;
    form.context.props.onChange = (value) => { changed = value; };
    form.run('NumericInput(props)').props.onChange({ target: { value: '25' } });
    assert.equal(changed, '25');
    const price = form.run("NumericInput({ ...props, inputMode: 'decimal' })");
    assert.equal(price.props.type, 'text');
    assert.equal(price.props.inputMode, 'decimal');
    assert.equal(price.props.step, undefined);
  });

  test(`${name}: stock validation accepts zero/integer and rejects invalid or overflowing values`, () => {
    for (const [value, expected] of [['0', true], ['42', true], ['0002', true], ['1e3', true], ['2147483647', true], ['', false], [' ', false], ['-1', false], ['1.5', false], ['abc', false], ['Infinity', false], ['2147483648', false], ['1e100', false]]) {
      form.context.value = value;
      assert.equal(form.run('isValidNonNegativeInteger(value)'), expected, value);
    }
  });
}

for (const callback of ['normalizeVariantNumber', 'normalizeSingleVariantNumber', 'normalizeBulkDraftNumber']) {
  test(`wizard: ${callback} leaves fractions/invalid values intact and normalizes exponent correctly`, () => {
    for (const [value, expected] of [['1.5', '1.5'], ['-1', '-1'], ['abc', 'abc'], ['', ''], ['2147483648', '2147483648'], ['1e3', '1000'], ['0002', '2'], ['0', '0']]) {
      let state = callback === 'normalizeVariantNumber' ? { sku: { ...drafts, stock: value } } : { ...drafts, stock: value };
      const set = (updater) => { state = updater(state); };
      Object.assign(wizard.context, { setVariantDrafts: set, setSingleVariantDraft: set, setBulkDraft: set });
      wizard.run(callback === 'normalizeVariantNumber' ? "normalizeVariantNumber('sku', 'stock')" : `${callback}('stock')`);
      assert.equal(callback === 'normalizeVariantNumber' ? state.sku.stock : state.stock, expected);
    }
  });
}

test('edit: blur never truncates fractions and preserves existing loaded values', () => {
  edit.context.product = { name: 'Produk', categoryId: 'category', description: '', variants: [{ id: 'sku', sku: 'SKU', price: '1250.50', stock: 0, minStock: 12, isActive: true, values: [] }] };
  const loaded = edit.run('createDraft(product)');
  assert.equal(loaded.variants[0].stock, '0');
  assert.equal(loaded.variants[0].minStock, '12');
  for (const [value, expected] of [['1.5', '1.5'], ['1e3', '1000'], ['2147483648', '2147483648'], ['0', '0']]) {
    let state = { ...loaded, variants: [{ ...loaded.variants[0], stock: value }] };
    edit.context.setDraft = (updater) => { state = updater(state); };
    edit.run("normalizeVariantNumber('sku', 'stock')");
    assert.equal(state.variants[0].stock, expected);
  }
});

test('mass input applies zero and integer stock to all or filtered SKU while preserving other values', () => {
  for (const filtered of [false, true]) {
    Object.assign(wizard.context, { selectedCombinations: combinations, activeVariationTypes: [{ id: 'color' }], bulkFilters: filtered ? { color: 'red' } : {} });
    const matched = wizard.run('getMatchedBulkCombinations(selectedCombinations, activeVariationTypes, bulkFilters)');
    let state = Object.fromEntries(combinations.map((c) => [c.key, { price: '750', stock: '3', minStock: '2' }]));
    Object.assign(wizard.context, { matchedBulkCombinations: matched, bulkDraft: { price: '', stock: '0', minStock: '1e3' }, setVariantDrafts(updater) { state = updater(state); } });
    wizard.run('applyBulkDraft()');
    for (const c of combinations) {
      const applies = !filtered || c.valueIds.includes('red');
      assert.equal(state[c.key].stock, applies ? '0' : '3');
      assert.equal(state[c.key].minStock, applies ? '1000' : '2');
      assert.equal(state[c.key].price, '750');
    }
  }
  for (const value of ['1.5', '-1', 'abc', '2147483648']) {
    wizard.context.bulkDraft = { price: '', stock: value, minStock: '' };
    assert.ok(wizard.run('buildBulkVariantPatch(bulkDraft)').error);
  }
  wizard.context.bulkDraft = { price: '', stock: '', minStock: '0' };
  assert.deepEqual(JSON.parse(JSON.stringify(wizard.run('buildBulkVariantPatch(bulkDraft)').patch)), { minStock: '0' });
});

test('create no/with variation and edit payloads convert exponent and zero to numeric integers', () => {
  const draft = { price: '1250.50', stock: '1e3', minStock: '0' };
  Object.assign(wizard.context, { name: 'Produk', categoryId: 'category', description: '', singleVariantDraft: draft, selectedCombinations: combinations, variantDrafts: Object.fromEntries(combinations.map((c) => [c.key, draft])), getActiveVariationTypeIds: () => ['color'] });
  for (const mode of ['tanpa', 'dengan']) {
    wizard.context.variationMode = mode;
    const payload = wizard.run('creationPayload()');
    assert.equal(payload.variants.length, mode === 'tanpa' ? 1 : 3);
    for (const variant of payload.variants) {
      assert.equal(variant.stock, 1000);
      assert.equal(variant.minStock, 0);
      assert.equal(variant.price, 1250.5);
    }
  }
  edit.context.draft = { name: 'Produk', categoryId: 'category', description: '', variants: [{ id: 'sku', sku: 'SKU', ...draft, isActive: true }] };
  assert.equal(edit.run('validateDraft(draft)'), null);
  const payload = edit.run('normalizeDraft(draft)');
  assert.equal(payload.variants[0].stock, 1000);
  assert.equal(payload.variants[0].minStock, 0);
});

test('required drafts reject empty, fraction, negative, overflow and preserve zero review', () => {
  wizard.context.selectedCombinations = combinations.slice(0, 1);
  for (const field of ['stock', 'minStock']) {
    for (const value of ['', '1.5', '-1', '2147483648']) {
      wizard.context.variantDrafts = { 'red|small': { ...drafts, [field]: value } };
      assert.ok(wizard.run('validateVariantDrafts(selectedCombinations, variantDrafts)'));
    }
  }
  wizard.context.variantDrafts = { 'red|small': { price: '0', stock: '0', minStock: '0' } };
  assert.equal(wizard.run('validateVariantDrafts(selectedCombinations, variantDrafts)'), null);
  assert.equal(wizard.run('buildReviewSummary(selectedCombinations, variantDrafts)').allZeroCount, 1);
});

test('actual save handlers reject invalid required stock and send numeric payloads for both creation modes and edit', async () => {
  for (const [form, mode] of [[wizard, 'tanpa'], [wizard, 'dengan'], [edit, 'edit']]) {
    let requests = [];
    Object.assign(form.context, { variationMode: mode, name: 'Produk', categoryId: 'category', description: '', selectedCombinations: combinations, getActiveVariationTypeIds: () => ['color'], product: { id: 'product' }, setLoading() {}, setSaving() {}, setDraft() {}, setSavedSnapshot() {}, router: { push() {}, refresh() {} }, fetch: async (url, options) => { requests.push(JSON.parse(options.body)); return { ok: true, json: async () => ({}) }; } });
    for (const value of ['', '-1', '1.5', 'abc', '2147483648', '0', '1e3']) {
      const current = { price: '1250.50', stock: value, minStock: '0' };
      Object.assign(form.context, { singleVariantDraft: current, variantDrafts: Object.fromEntries(combinations.map((c) => [c.key, current])), draft: { name: 'Produk', categoryId: 'category', description: '', variants: [{ id: 'sku', sku: 'SKU', ...current, isActive: true }] } });
      requests = [];
      await form.run('handleSave()');
      assert.equal(requests.length, value === '0' || value === '1e3' ? 1 : 0, `${mode}: ${value}`);
      if (requests.length) {
        for (const variant of requests[0].variants) {
          assert.equal(variant.stock, value === '0' ? 0 : 1000);
          assert.equal(variant.minStock, 0);
          assert.equal(typeof variant.stock, 'number');
        }
      }
    }
  }
});

const creation = loadForm('lib/product-variant-creation.ts');
const update = loadForm('app/api/products/[id]/route.ts');

test('backend creation/edit parsers preserve integer numbers and reject invalid required stock', () => {
  for (const value of [0, 25, 2147483647, '', -1, 1.5, 'abc', null]) {
    creation.context.inputs = [{ valueIds: [], price: 1250.5, stock: value, minStock: 0 }];
    update.context.inputs = [{ id: 'sku', price: 1250.5, stock: value, minStock: 0, isActive: true }];
    for (const [form, call] of [[creation, 'parseProductVariantInputs(inputs)'], [update, 'parseVariantUpdates(inputs)']]) {
      if (typeof value === 'number' && value >= 0 && Number.isInteger(value)) {
        assert.equal(form.run(call)[0].stock, value);
      } else {
        assert.throws(() => form.run(call));
      }
    }
  }
});

test('creation writes stock history and integer quantity for no/with variation; zero does not add history', async () => {
  for (const withVariation of [false, true]) {
    for (const stock of [0, 25]) {
      const writes = [];
      const valueIds = withVariation ? ['red'] : [];
      creation.context.tx = {
        productVariationType: { findMany: async () => withVariation ? [{ variationTypeId: 'color' }] : [] },
        variationValue: { findMany: async () => [{ id: 'red', value: 'Merah', variationTypeId: 'color' }] },
        productVariant: { findUnique: async () => null, create: async ({ data }) => { writes.push(['variant', data]); return { id: 'sku', ...data, stock: 0 }; }, update: async (args) => { writes.push(['stock', args.data]); } },
        stockIn: { create: async ({ data }) => { writes.push(['history', data]); } },
      };
      creation.context.inputs = [{ valueIds, price: 1250.5, stock, minStock: 0 }];
      const saved = await creation.run("createProductVariants(tx, { id: 'product', name: 'Produk' }, parseProductVariantInputs(inputs), { initialStockUserId: 'admin' })");
      assert.equal(saved[0].stock, stock);
      assert.equal(writes[0][1].minStock, 0);
      const history = writes.filter(([kind]) => kind === 'history');
      assert.equal(history.length, stock === 0 ? 0 : 1);
      if (stock > 0) {
        assert.equal(history[0][1].quantity, 25);
        assert.equal(history[0][1].userId, 'admin');
        assert.equal(writes.find(([kind]) => kind === 'stock')[1].stock.increment, 25);
      }
    }
  }
});

test('edit stock changes preserve audited increments/decrements and zero stock', async () => {
  for (const stock of [0, 10, 25]) {
    const writes = [];
    update.context.tx = {
      stockIn: { create: async ({ data }) => { writes.push(['in', data]); } },
      stockOut: { create: async ({ data }) => { writes.push(['out', data]); } },
      productVariant: { updateMany: async (args) => { writes.push(['stock', args]); return { count: 1 }; } },
    };
    update.context.variant = { id: 'sku', stock, minStock: 0, isActive: true };
    await update.run("applyAuditedStockDelta(tx, 'admin', 'batch', variant, { stock: 10, sku: 'SKU' })");
    if (stock === 10) {
      assert.equal(writes.length, 0);
    } else {
      assert.equal(writes[0][0], stock === 0 ? 'out' : 'in');
      assert.equal(writes[0][1].quantity, stock === 0 ? 10 : 15);
      assert.equal(writes[1][1].where.stock, 10);
      assert.equal(writes[1][1].where.isActive, true);
    }
  }
});
