import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const days = Array.from({ length: 69 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 7, i + 1)).toISOString().slice(0, 10);
  return { date, revenue: i === 0 ? 1_400_000 : i === 68 ? 700_000 : 0, transactionCount: i === 0 ? 2 : i === 68 ? 1 : 0 };
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
import { SalesPerformancePanel } from './components/dashboard/SalesPerformancePanel';
const kind = new URLSearchParams(location.search).get('view');
const performance = ${JSON.stringify(performance)};
const content = <SalesPerformancePanel performance={kind === "error" ? null : kind === "no-days" ? {...performance, days: []} : kind === "empty" ? {...performance, days: performance.days.map(d => ({...d, revenue: 0, transactionCount: 0}))} : performance} error={kind === "error" ? "Gagal memuat performa penjualan." : null} />;
createRoot(document.getElementById('root')).render(content);
`;
const bundle = await build({
  stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false,
  platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
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
  for (const width of [390, 768, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width === 390 });
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/sales/performance**', async route => {
      const params = new URL(route.request().url()).searchParams;
      const from = params.get('from');
      const to = params.get('to');
      requests.push({ from, to });
      if (to === '2025-01-05') {
        return route.fulfill({ status: 503, json: { success: false, error: 'Layanan sedang tidak tersedia.' } });
      }
      const data = {
        period: { fromInput: from, toInput: to, timezone: 'Asia/Singapore' },
        days: [
          { date: from, revenue: 100.25, transactionCount: 2 },
          { date: to, revenue: 50.1, transactionCount: 1 },
        ],
        months: [],
      };
      return route.fulfill({ json: { success: true, data } });
    });
    async function open(view) {
      await page.goto(`${origin}/?view=${view}`);
      await page.locator('h1,h2').first().waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${view} overflows at ${width}`);
    }
    await open('chart');
    assert.equal(await page.getByRole('heading', { name: 'Performance penjualan toko', exact: true }).count(), 1);
    const fromInput = page.getByLabel('Tanggal awal', { exact: true });
    const toInput = page.getByLabel('Tanggal akhir', { exact: true });
    assert.equal(await fromInput.inputValue(), '2026-08-01');
    assert.equal(await toInput.inputValue(), '2026-10-08');
    const defaultFrom = await fromInput.inputValue();
    const defaultTo = await toInput.inputValue();
    assert.equal(await page.getByLabel('Pilih tanggal', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Lihat tabel data harian', { exact: true }).count(), 0);
    assert.equal(await page.locator('article,details,a').count(), 0);
    await page.waitForFunction(() => { const chart = document.querySelector('[data-slot=chart]'); const svg = chart?.querySelector('svg'); return svg && Math.abs(svg.getBoundingClientRect().width - chart.getBoundingClientRect().width) < 2; });
    await page.locator('[data-slot=chart] svg text').evaluateAll(texts => texts.forEach(text => text.style.fontSize = '16px'));
    const axisLayout = await page.evaluate(() => {
      const axis = document.querySelector('.recharts-yAxis');
      const label = [...document.querySelectorAll('svg .recharts-label')].find(label => label.textContent === 'Omzet (Rp)').getBoundingClientRect();
      const ticks = [...axis.querySelectorAll('.recharts-cartesian-axis-tick-value')].map(tick => tick.getBoundingClientRect());
      const chart = document.querySelector('[data-slot=chart]').getBoundingClientRect();
      return { labelLeft: label.left, labelRight: label.right, chartLeft: chart.left, tickLeft: Math.min(...ticks.map(tick => tick.left)) };
    });
    assert.ok(axisLayout.labelRight + 8 <= axisLayout.tickLeft, `Label omzet bertumpuk dengan angka pada ${width}px: ${JSON.stringify(axisLayout)}`);
    assert.ok(axisLayout.labelLeft >= axisLayout.chartLeft, `Label omzet terpotong pada ${width}px`);
    await fromInput.fill('2025-01-02');
    await toInput.fill('2025-01-03');
    await page.getByRole('button', { name: /^(Tampilkan|Coba lagi)$/ }).click();
    await page.getByText('Omzet harian 2025-01-02 sampai 2025-01-03.').waitFor();
    assert.deepEqual(requests.at(-1), { from: '2025-01-02', to: '2025-01-03' });

    await fromInput.fill('2025-01-04');
    await toInput.fill('2025-01-05');
    await page.getByRole('button', { name: /^(Tampilkan|Coba lagi)$/ }).click();
    await page.getByRole('alert').filter({ hasText: 'Layanan sedang tidak tersedia.' }).waitFor();
    await page.getByText('Omzet harian 2025-01-02 sampai 2025-01-03.').waitFor();
    assert.equal(await fromInput.isDisabled(), false);
    assert.equal(await toInput.isDisabled(), false);

    const requestCount = requests.length;
    await fromInput.fill('2025-01-04');
    await toInput.fill('2025-01-03');
    await page.getByRole('button', { name: /^(Tampilkan|Coba lagi)$/ }).click();
    await page.getByRole('alert').filter({ hasText: 'Tanggal awal' }).waitFor();
    assert.equal(requests.length, requestCount);

    await fromInput.fill('2024-01-01');
    await toInput.fill('2026-01-02');
    await page.getByRole('button', { name: 'Tampilkan', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'maksimal 1 tahun' }).waitFor();
    assert.equal(requests.length, requestCount);

    await fromInput.fill(defaultFrom);
    await toInput.fill(defaultTo);
    await page.getByRole('button', { name: 'Tampilkan', exact: true }).click();
    await page.getByText(`Omzet harian ${defaultFrom} sampai ${defaultTo}.`).waitFor();
    assert.deepEqual(errors, []);

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
    await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
    await page.getByText('Omzet harian 2025-01-02 sampai 2025-01-03.').waitFor();
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('PASS: real components/styles at 390/768/1280px; Y-axis label clear of currency ticks; default date range, historical fetch, validation, retry, retained chart data, and removed detail UI. API boundary mocked.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
