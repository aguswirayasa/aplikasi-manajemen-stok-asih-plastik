import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const users = [
  { id: 'admin', name: 'Admin Test', username: 'admin', role: 'ADMIN', isActive: true, email: 'admin@example.com', createdAt: '2026-01-01' },
  { id: 'other', name: 'Admin Lain', username: 'other', role: 'ADMIN', isActive: true, email: null, createdAt: '2026-01-01' },
  { id: 'employee', name: 'Pegawai Test', username: 'employee', role: 'PEGAWAI', isActive: true, email: null, createdAt: '2026-01-01' },
];
const days = Array.from({ length: 69 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 7, i + 1)).toISOString().slice(0, 10);
  return { date, revenue: i === 0 ? 100.25 : i === 68 ? 50.1 : 0, transactionCount: i === 0 ? 2 : i === 68 ? 1 : 0 };
});
const performance = {
  period: { fromInput: '2026-08-01', toInput: '2026-10-08', timezone: 'Asia/Singapore' }, days,
  months: [
    { month: '2026-08', revenue: 100.25, transactionCount: 2, isCurrentMonth: false },
    { month: '2026-09', revenue: 0, transactionCount: 0, isCurrentMonth: false },
    { month: '2026-10', revenue: 50.1, transactionCount: 1, isCurrentMonth: true },
  ],
};
const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { ForgotPasswordForm } from './components/auth/ForgotPasswordForm';
import { ResetPasswordForm } from './components/auth/ResetPasswordForm';
import { UserManagementClient } from './components/users/UserManagementClient';
import { SalesPerformancePanel } from './components/dashboard/SalesPerformancePanel';
const kind = new URLSearchParams(location.search).get('view');
window.__signOutCalls = 0;
window.__refreshCalls = 0;
const performance = ${JSON.stringify(performance)};
const content = kind === 'forgot' ? <ForgotPasswordForm />
 : kind === 'reset' ? <ResetPasswordForm token={'a'.repeat(64)} />
 : kind === 'invalid' ? <ResetPasswordForm token={null} />
 : kind === 'users' ? <UserManagementClient currentUserId="admin" />
 : <SalesPerformancePanel performance={kind === 'error' ? null : kind === 'no-days' ? {...performance, days: []} : kind === 'empty' ? {...performance, days:performance.days.map(d=>({...d,revenue:0,transactionCount:0})),months:performance.months.map(m=>({...m,revenue:0,transactionCount:0}))} : performance} error={kind === 'error' ? 'Gagal memuat performa penjualan.' : null} />;
createRoot(document.getElementById('root')).render(<>{content}<Toaster /></>);
`;
const bundle = await build({
  stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false,
  platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'isolated-navigation', setup(builder) {
    builder.onResolve({ filter: /^next\/(link|navigation)$|^next-auth\/react$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: process.cwd(), contents:
      args.path === 'next/link' ? `import React from 'react';export default function Link(props){return <a {...props}/>;}`
        : args.path === 'next/navigation' ? `export function useRouter(){return {refresh(){window.__refreshCalls++}}}`
          : `export async function signOut(){window.__signOutCalls++;return {url:'/login'}}` }));
  } }],
});
const css = await postcss([tailwind()]).process(await fs.readFile('app/globals.css', 'utf8'), { from: 'app/globals.css' });
const server = http.createServer((req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].contents); }
  else if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(css.css); }
  else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width === 390 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const requests = [];
    await page.route('**/api/**', async route => {
      const req = route.request();
      const body = req.postDataJSON();
      requests.push({ url: req.url(), method: req.method(), body });
      if (req.url().includes('/api/sales/performance')) {
        const params = new URL(req.url()).searchParams;
        const fromInput = params.get('from');
        const toInput = params.get('to');
        return route.fulfill({ json: { success: true, data: {
          period: { fromInput, toInput, timezone: 'Asia/Singapore' },
          days: [
            { date: fromInput, revenue: 100.25, transactionCount: 2 },
            { date: toInput, revenue: 50.1, transactionCount: 1 },
          ],
          months: [],
        } } });
      }
      if (req.url().endsWith('/api/users') && req.method() === 'GET') {
        return route.fulfill({ json: { success: true, data: users } });
      }
      if (req.url().includes('/forgot-password')) {
        return route.fulfill({ json: { success: true, data: null, message: 'Jika akun terdaftar dan memiliki email pemulihan, Anda akan menerima tautan reset password.' } });
      }
      return route.fulfill({ json: { success: true, data: null, message: 'Password berhasil direset. Silakan masuk kembali.' } });
    });
    async function open(view) {
      await page.goto(`${origin}/?view=${view}`);
      await page.locator('h1,h2').first().waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${view} overflows at ${width}`);
    }
    await open('forgot');
    await page.getByText('Admin dan pegawai dapat meminta tautan reset melalui email pemulihan yang sudah disimpan.').waitFor();
    await page.getByLabel('Username atau email').fill('employee');
    await page.getByRole('button', { name: 'Kirim tautan reset' }).click();
    await page.getByRole('status').filter({ hasText: 'Jika akun' }).waitFor();
    assert.deepEqual(requests.at(-1).body, { identifier: 'employee' });
    await open('invalid');
    assert.equal(await page.locator('input[type=password]').count(), 0);
    assert.equal(await page.getByRole('link', { name: 'Minta tautan baru' }).getAttribute('href'), '/forgot-password');
    await open('reset');
    const beforeReset = requests.length;
    await page.getByLabel('Password baru', { exact: true }).fill('new-password');
    await page.getByLabel('Konfirmasi password').fill('different-password');
    await page.getByRole('button', { name: 'Simpan password baru' }).click();
    await page.getByRole('alert').filter({ hasText: 'tidak cocok' }).waitFor();
    assert.equal(requests.length, beforeReset);
    await page.getByLabel('Password baru', { exact: true }).fill('😀'.repeat(19));
    await page.getByLabel('Konfirmasi password').fill('😀'.repeat(19));
    await page.getByRole('button', { name: 'Simpan password baru' }).click();
    await page.getByRole('alert').filter({ hasText: '72 byte' }).waitFor();
    assert.equal(requests.length, beforeReset);
    await page.getByLabel('Password baru', { exact: true }).fill('new-password');
    await page.getByLabel('Konfirmasi password').fill('new-password');
    await page.getByRole('button', { name: 'Simpan password baru' }).click();
    await page.getByRole('link', { name: 'Masuk kembali' }).waitFor();
    assert.equal(await page.evaluate(() => window.__signOutCalls), 1);
    assert.equal(requests.at(-1).body.token, 'a'.repeat(64));
    await open('users');
    await page.getByRole('button', { name: 'Edit Admin Test', exact: true }).filter({ visible: true }).click();
    await page.getByLabel('Email pemulihan', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Password saat ini', { exact: true }).count(), 0);
    await page.getByLabel('Email pemulihan', { exact: true }).fill('NEW@example.com');
    await page.getByLabel('Password saat ini', { exact: true }).fill('current-password');
    await page.getByRole('button', { name: 'Simpan User' }).click();
    await page.getByRole('heading', { name: 'Edit User' }).waitFor({ state: 'hidden' });
    const emailRequest = requests.findLast(req => req.method === 'PUT');
    assert.equal(emailRequest.body.email, 'new@example.com');
    assert.equal(emailRequest.body.currentPassword, 'current-password');
    await page.getByRole('button', { name: 'Edit Admin Lain', exact: true }).filter({ visible: true }).click();
    assert.equal(await page.getByLabel('Email pemulihan', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Batal', exact: true }).click();
    await page.getByRole('button', { name: 'Edit Pegawai Test', exact: true }).filter({ visible: true }).click();
    await page.getByText('Email akun pegawai (opsional) menerima tautan reset password dan tidak diverifikasi secara terpisah. Pastikan alamat benar dan milik pegawai. Kosongkan jika tidak ingin menyimpan email.').waitFor();
    await page.getByLabel('Email', { exact: true }).fill(' STAFF@example.com ');
    assert.equal(await page.getByLabel('Password saat ini', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Simpan User' }).click();
    await page.getByRole('heading', { name: 'Edit User' }).waitFor({ state: 'hidden' });
    const employeeEmailRequest = requests.findLast(req => req.method === 'PUT');
    assert.ok(employeeEmailRequest.url.endsWith('/api/users/employee'));
    assert.equal(employeeEmailRequest.body.email, 'staff@example.com');
    assert.equal(employeeEmailRequest.body.currentPassword, undefined);
    for (const role of ['PEGAWAI', 'ADMIN']) {
      await page.getByRole('button', { name: 'Tambah User', exact: true }).click();
      await page.getByLabel('Username', { exact: true }).fill(`new-${role.toLowerCase()}`);
      await page.getByLabel('Nama lengkap', { exact: true }).fill('New User');
      await page.getByLabel('Password awal', { exact: true }).fill('new-password');
      await page.getByRole('combobox').selectOption(role);
      await page.getByLabel(role === 'ADMIN' ? 'Email pemulihan' : 'Email', { exact: true }).fill(`${role}@example.com`);
      assert.equal(await page.getByLabel('Password saat ini', { exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Simpan User' }).click();
      await page.getByRole('heading', { name: 'User Baru' }).waitFor({ state: 'hidden' });
      const creation = requests.findLast(req => req.method === 'POST' && req.url.endsWith('/api/users'));
      assert.equal(creation.body.role, role);
      assert.equal(creation.body.email, `${role.toLowerCase()}@example.com`);
      assert.equal(creation.body.currentPassword, undefined);
    }
    await open('chart');
    assert.equal(await page.getByRole('heading', { name: 'Performance penjualan toko', exact: true }).count(), 1);
    const fromInput = page.getByLabel('Tanggal awal', { exact: true });
    const toInput = page.getByLabel('Tanggal akhir', { exact: true });
    assert.equal(await fromInput.inputValue(), '2026-08-01');
    assert.equal(await toInput.inputValue(), '2026-10-08');
    assert.equal(await page.getByLabel('Pilih tanggal', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Lihat tabel data harian', { exact: true }).count(), 0);
    await page.waitForFunction(() => { const chart = document.querySelector('[data-slot=chart]'); const svg = chart?.querySelector('svg'); return svg && Math.abs(svg.getBoundingClientRect().width - chart.getBoundingClientRect().width) < 2; });
    await fromInput.fill('2025-01-02');
    await toInput.fill('2025-01-03');
    await page.getByRole('button', { name: 'Tampilkan', exact: true }).click();
    await page.getByText('Omzet harian 2025-01-02 sampai 2025-01-03.').waitFor();
    assert.ok(requests.at(-1).url.includes('from=2025-01-02&to=2025-01-03'));
    await open('empty');
    assert.doesNotMatch(await page.locator('svg').innerHTML(), /NaN|Infinity/);
    await open('no-days');
    await page.getByText('Data harian tidak tersedia.').waitFor();
    await open('error');
    await page.getByRole('alert').waitFor();
    const retryFrom = page.getByLabel('Tanggal awal', { exact: true });
    const retryTo = page.getByLabel('Tanggal akhir', { exact: true });
    assert.equal(await retryFrom.isDisabled(), false);
    await retryFrom.fill('2025-01-02');
    await retryTo.fill('2025-01-03');
    await page.getByRole('button', { name: 'Coba lagi' }).click();
    await page.getByText('Omzet harian 2025-01-02 sampai 2025-01-03.').waitFor();
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('PASS: real components/styles at 390/1280px; recovery flows, user updates, historical chart range and retry. API/navigation boundaries mocked.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
