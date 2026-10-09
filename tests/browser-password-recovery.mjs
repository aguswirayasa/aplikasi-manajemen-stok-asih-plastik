import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const screenshots = path.join(tmpdir(), 'asih-password-recovery');
await fs.mkdir(screenshots, { recursive: true });
const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { ForgotPasswordForm } from './components/auth/ForgotPasswordForm';
import { ResetPasswordForm } from './components/auth/ResetPasswordForm';
const kind = new URLSearchParams(location.search).get('view');
window.__signOutCalls = 0;
const content = kind === 'forgot' ? <ForgotPasswordForm />
 : kind === 'reset' ? <ResetPasswordForm token={'a'.repeat(64)} />
 : kind === 'invalid' ? <ResetPasswordForm token={null} />
 : null;
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
  else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html style="--font-sans:Inter,Helvetica,Arial,sans-serif"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body style="--font-sans:Inter,Helvetica,Arial,sans-serif"><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
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
    const submitButton = page.getByRole('button', { name: 'Kirim tautan reset' });
    assert.equal(await submitButton.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 79, 0)');
    if (width === 1280) {
      await submitButton.hover();
      await page.waitForTimeout(250);
      assert.equal(await submitButton.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(224, 69, 0)');
    }
    await submitButton.click();
    await page.locator('form [role=alert]').filter({ hasText: 'Username atau email wajib diisi' }).waitFor();
    await page.getByLabel('Username atau email').fill('employee');
    await page.route('**/api/auth/forgot-password', route => route.fulfill({ status: 429, json: { error: 'Terlalu banyak permintaan. Coba lagi nanti.' } }));
    await submitButton.click();
    await page.locator('form [role=alert]').filter({ hasText: 'Terlalu banyak permintaan' }).waitFor();
    await page.screenshot({ path: path.join(screenshots, 'forgot-error-' + width + '.png') });
    await page.unroute('**/api/auth/forgot-password');
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
    const resetButton = page.getByRole('button', { name: 'Simpan password baru' });
    assert.equal(await resetButton.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 79, 0)');
    if (width === 1280) {
      await resetButton.hover();
      await page.waitForTimeout(250);
      assert.equal(await resetButton.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(224, 69, 0)');
    }
    await resetButton.click();
    await page.locator('form [role=alert]').filter({ hasText: 'minimal 8 karakter' }).waitFor();
    await page.getByLabel('Password baru', { exact: true }).fill('new-password');
    await page.getByLabel('Konfirmasi password').fill('new-password');
    await page.route('**/api/auth/reset-password', route => route.fulfill({ status: 400, json: { error: 'Tautan reset tidak valid atau sudah kedaluwarsa.' } }));
    await resetButton.click();
    await page.locator('form [role=alert]').filter({ hasText: 'kedaluwarsa' }).waitFor();
    await page.route('**/api/auth/reset-password', route => route.abort());
    await resetButton.click();
    await page.locator('form [role=alert]').filter({ hasText: 'Gagal mereset password. Silakan coba lagi.' }).waitFor();
    await page.screenshot({ path: path.join(screenshots, 'reset-error-' + width + '.png') });
    await page.unroute('**/api/auth/reset-password');
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
    await open('reset');
    await page.screenshot({ path: path.join(screenshots, 'reset-' + width + '.png') });
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('PASS: recovery forms at 390/1280px, orange default/hover, empty/mismatched/oversize password errors, API errors, network failure, invalid links and successful reset. API/navigation mocked.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
