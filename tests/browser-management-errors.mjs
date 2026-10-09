import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { VariationManagementClient } from './components/variations/VariationManagementClient';
import { CategoryManagementClient } from './components/categories/CategoryManagementClient';
import { UserManagementClient } from './components/users/UserManagementClient';
const view = new URLSearchParams(location.search).get('view');
const page = view === 'variations' ? <VariationManagementClient /> : view === 'categories' ? <CategoryManagementClient /> : <UserManagementClient currentUserId="admin" />;
createRoot(document.getElementById('root')).render(<>{page}<Toaster /></>);
`;
const bundle = await build({
  stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'mock-next-auth', setup(builder) {
    builder.onResolve({ filter: /^next-auth\/react$/ }, () => ({ path: 'next-auth/react', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'js', contents: 'export async function signOut(){}' }));
  } }],
});
const css = await postcss([tailwind()]).process(await fs.readFile('app/globals.css', 'utf8'), { from: 'app/globals.css' });
const server = http.createServer((req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].contents); }
  else if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(css.css); }
  else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    let failCategoryRename = true;
    let failCategoryNetwork = false;
    let failUserLoad = true;
    await page.route('**/api/**', async route => {
      const req = route.request();
      const url = req.url();
      if (failCategoryNetwork && url.endsWith('/api/categories') && req.method() === 'POST') {
        failCategoryNetwork = false;
        return route.abort();
      }
      if (req.method() === 'GET' && url.endsWith('/api/categories')) {
        return route.fulfill({ json: { success: true, data: [{ id: 'category-1', name: 'Plastik', _count: { products: 0 } }] } });
      }
      if (req.method() === 'GET' && url.endsWith('/api/variations/types')) {
        return route.fulfill({ json: { success: true, data: [{ id: 'type-1', name: 'Warna', values: [{ id: 'value-1', value: 'Merah', _count: { productVariantValues: 0 } }], _count: { productVariationTypes: 0 } }] } });
      }
      if (req.method() === 'GET' && url.endsWith('/api/users')) {
        if (failUserLoad) {
          failUserLoad = false;
          return route.fulfill({ status: 500, json: { success: false, error: 'Gagal memuat user.' } });
        }
        return route.fulfill({ json: { success: true, data: [{ id: 'admin', name: 'Admin', username: 'admin', role: 'ADMIN', isActive: true, email: null, createdAt: '2026-01-01' }, { id: 'staff', name: 'Staff', username: 'staff', role: 'PEGAWAI', isActive: true, email: null, createdAt: '2026-01-01' }] } });
      }
      if (req.method() === 'PUT' && url.endsWith('/api/categories/category-1') && !failCategoryRename) {
        return route.fulfill({ json: { success: true, data: { id: 'category-1', name: 'Nama baru', _count: { products: 0 } }, message: 'Kategori diperbarui.' } });
      }
      if (req.method() === 'PUT' && url.endsWith('/api/categories/category-1')) failCategoryRename = false;
      const body = req.postDataJSON();
      const error = req.method() === 'DELETE' && url.includes('/api/users') ? 'Gagal mengubah status user.' : req.method() === 'DELETE' && url.includes('/api/categories') ? 'Kategori masih digunakan.' : req.method() === 'DELETE' && url.includes('/api/variations/values') ? 'Nilai variasi masih digunakan.' : url.includes('/api/users') && body?.username === 'network' ? 'Layanan sedang bermasalah.' : url.includes('/api/users') ? 'Username sudah digunakan.' : url.includes('/api/categories') ? 'Kategori sudah ada.' : url.includes('/api/variations/types') ? 'Tipe variasi sudah ada.' : 'Nilai variasi sudah ada.';
      return route.fulfill({ status: 409, json: { success: false, error } });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/?view=categories`);
    await page.getByRole('button', { name: 'Tambah Kategori', exact: true }).click();
    const categoryInput = page.getByPlaceholder('Nama kategori');
    await categoryInput.fill('Duplikat');
    await page.getByTitle('Simpan kategori').click();
    await page.getByRole('alert').filter({ hasText: 'Kategori sudah ada.' }).waitFor();
    assert.equal(await categoryInput.getAttribute('aria-invalid'), 'true');
    assert.equal(await categoryInput.inputValue(), 'Duplikat');
    await categoryInput.fill('Kategori baru');
    assert.equal(await page.getByRole('alert').filter({ hasText: 'Kategori sudah ada.' }).count(), 0);
    await page.getByTitle('Edit nama').click();
    const categoryRename = page.getByPlaceholder('Nama kategori...');
    await categoryRename.fill('Nama bentrok');
    await page.getByTitle('Simpan', { exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Kategori sudah ada.' }).waitFor();
    assert.equal(await categoryRename.inputValue(), 'Nama bentrok');
    assert.equal(await categoryRename.getAttribute('aria-invalid'), 'true');
    await categoryRename.fill('Nama baru');
    await page.getByTitle('Simpan', { exact: true }).click();
    await page.getByText('Nama baru', { exact: true }).waitFor();
    failCategoryNetwork = true;
    await categoryInput.fill('Jaringan');
    await page.getByTitle('Simpan kategori').click();
    await page.getByRole('alert').filter({ hasText: 'Gagal membuat kategori. Periksa koneksi lalu coba lagi.' }).waitFor();
    await page.getByTitle('Hapus kategori').click();
    await page.getByRole('button', { name: 'Hapus', exact: true }).last().click();
    await page.getByRole('alert').filter({ hasText: 'Kategori masih digunakan.' }).waitFor();

    await page.goto(`http://127.0.0.1:${server.address().port}/?view=variations`);
    await page.getByRole('button', { name: 'Tambah Tipe Variasi' }).click();
    const typeInput = page.getByPlaceholder(/Nama tipe/);
    await typeInput.fill('Duplikat');
    await page.getByRole('button', { name: 'Simpan' }).click();
    await page.getByRole('alert').filter({ hasText: 'Tipe variasi sudah ada.' }).waitFor();
    assert.equal(await typeInput.getAttribute('aria-invalid'), 'true');
    await page.getByRole('button', { name: 'Tambah nilai' }).click();
    const valueInput = page.getByPlaceholder('Nilai baru...');
    await valueInput.fill('Duplikat');
    await page.getByTitle('Tambah').click();
    await page.locator('input[placeholder="Nilai baru..."][aria-invalid="true"]').waitFor();
    await page.locator(`[id="${await valueInput.getAttribute('aria-describedby')}"]`).filter({ hasText: 'Nilai variasi sudah ada.' }).waitFor();
    assert.equal(await valueInput.getAttribute('aria-invalid'), 'true');
    await page.getByText('Merah', { exact: true }).hover();
    await page.getByTitle('Edit', { exact: true }).click();
    const valueRename = page.getByPlaceholder('Nama...');
    await valueRename.fill('Hijau');
    await page.getByTitle('Simpan', { exact: true }).click();
    await page.locator('input[placeholder="Nama..."][aria-invalid="true"]').waitFor();
    await page.locator(`[id="${await valueRename.getAttribute('aria-describedby')}"]`).filter({ hasText: 'Nilai variasi sudah ada.' }).waitFor();
    assert.equal(await valueRename.inputValue(), 'Hijau');
    await valueRename.press('Escape');
    await page.getByText('Merah', { exact: true }).hover();
    await page.getByTitle('Hapus', { exact: true }).click();
    await page.getByRole('button', { name: 'Hapus', exact: true }).last().click();
    await page.getByRole('alert').filter({ hasText: 'Nilai variasi masih digunakan.' }).waitFor();
    await page.goto(`http://127.0.0.1:${server.address().port}/?view=users`);
    await page.getByRole('alert').filter({ hasText: 'Gagal memuat user.' }).waitFor();
    await page.getByRole('button', { name: 'Coba lagi' }).click();
    await page.getByText('Admin', { exact: true }).filter({ visible: true }).first().waitFor();
    await page.getByRole('button', { name: 'Tambah User' }).click();
    await page.getByLabel('Username', { exact: true }).fill('taken');
    await page.getByLabel('Nama lengkap', { exact: true }).fill('Nama Baru');
    await page.getByLabel('Password awal', { exact: true }).fill('password-123');
    await page.getByRole('button', { name: 'Simpan User' }).click();
    await page.getByRole('alert').filter({ hasText: 'Username sudah digunakan.' }).waitFor();
    assert.equal(await page.getByLabel('Username', { exact: true }).getAttribute('aria-invalid'), 'true');
    assert.equal(await page.getByLabel('Username', { exact: true }).inputValue(), 'taken');
    await page.getByLabel('Username', { exact: true }).fill('network');
    await page.getByRole('button', { name: 'Simpan User' }).click();
    await page.getByRole('alert').filter({ hasText: 'Layanan sedang bermasalah.' }).waitFor();
    assert.equal(await page.getByLabel('Username', { exact: true }).inputValue(), 'network');
    await page.getByRole('button', { name: 'Batal', exact: true }).click();
    await page.getByRole('button', { name: 'Nonaktifkan Staff', exact: true }).filter({ visible: true }).click();
    await page.getByRole('button', { name: 'Nonaktifkan', exact: true }).last().click();
    await page.getByRole('alert').filter({ hasText: 'Gagal mengubah status user.' }).waitFor();
    assert.deepEqual(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.close();
  }
  console.log('PASS: inline field and form errors, correction/retry, network/load/delete failures, user status feedback, and responsive layout at 390/1280px. API mocked.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
