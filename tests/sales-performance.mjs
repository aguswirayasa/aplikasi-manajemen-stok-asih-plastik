import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(`${process.cwd()}/package.json`);
const ts = require("typescript");
const prisma = { sale: { findMany: async () => [] } };
const sales = loadTypeScript("lib/sales.ts", {
  "@/lib/prisma": { __esModule: true, default: prisma },
  "@/lib/api-helpers": {
    ApiError: class ApiError extends Error {
      constructor(message, status) {
        super(message);
        this.status = status;
      }
    },
  },
});

function loadTypeScript(path, mocks) {
  const source = fs.readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(id) {
      if (mocks[id]) return mocks[id];
      if (id === "date-fns" || id === "date-fns-tz") return require(id);
      throw new Error(`Unexpected dependency: ${id}`);
    },
    process,
    URL,
    URLSearchParams,
  });
  return exports;
}

function assertData(actual, expected) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
}

function restoreTimezone(timezone) {
  if (timezone === undefined) delete process.env.TZ;
  else process.env.TZ = timezone;
}

test("daily and monthly buckets count transactions and add cents exactly across leap day", async () => {
  const originalTimezone = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  const queries = [];
  prisma.sale.findMany = async (query) => {
    queries.push(query);
    return [
      { createdAt: new Date("2023-12-31T15:59:59.999Z"), totalAmount: "999.99" },
      { createdAt: new Date("2023-12-31T16:00:00.000Z"), totalAmount: "0.10" },
      { createdAt: new Date("2023-12-31T16:00:00.000Z"), totalAmount: "0.20" },
      { createdAt: new Date("2024-02-29T15:59:59.999Z"), totalAmount: "1.01" },
      { createdAt: new Date("2024-03-01T15:59:59.999Z"), totalAmount: "2.25" },
      { createdAt: new Date("2024-03-01T16:00:00.000Z"), totalAmount: "999.99" },
    ];
  };

  try {
    const result = await sales.getSalesPerformance(new Date("2024-03-01T15:59:59.999Z"));
    assert.equal(result.period.fromInput, "2024-01-01");
    assert.equal(result.period.toInput, "2024-03-01");
    assert.equal(result.period.timezone, "Asia/Singapore");
    assert.equal(result.days.length, 61);
    assertData(
      result.days.find((day) => day.date === "2024-01-01"),
      { date: "2024-01-01", revenue: 0.3, transactionCount: 2 }
    );
    assertData(
      result.days.find((day) => day.date === "2024-02-29"),
      { date: "2024-02-29", revenue: 1.01, transactionCount: 1 }
    );
    assertData(
      result.days.find((day) => day.date === "2024-03-01"),
      { date: "2024-03-01", revenue: 2.25, transactionCount: 1 }
    );
    assertData(
      result.days.find((day) => day.date === "2024-01-15"),
      { date: "2024-01-15", revenue: 0, transactionCount: 0 }
    );
    assertData(result.months, [
      { month: "2024-01", revenue: 0.3, transactionCount: 2, isCurrentMonth: false },
      { month: "2024-02", revenue: 1.01, transactionCount: 1, isCurrentMonth: false },
      { month: "2024-03", revenue: 2.25, transactionCount: 1, isCurrentMonth: true },
    ]);
    assert.equal(queries.length, 1);
    assertData(queries[0].select, { createdAt: true, totalAmount: true });
    assert.equal(queries[0].where.createdAt.gte.toISOString(), "2023-12-31T16:00:00.000Z");
    assert.equal(queries[0].where.createdAt.lte.toISOString(), "2024-03-01T15:59:59.999Z");
  } finally {
    restoreTimezone(originalTimezone);
  }
});

test("Singapore midnight and year rollover use the previous two complete calendar months", async () => {
  const originalTimezone = process.env.TZ;
  process.env.TZ = "Pacific/Honolulu";
  prisma.sale.findMany = async () => [
    { createdAt: new Date("2024-10-31T16:00:00.000Z"), totalAmount: "5.00" },
    { createdAt: new Date("2024-12-31T16:00:00.000Z"), totalAmount: "0.01" },
  ];
  try {
    const result = await sales.getSalesPerformance(new Date("2024-12-31T16:30:00.000Z"));
    assert.equal(result.period.fromInput, "2024-11-01");
    assert.equal(result.period.toInput, "2025-01-01");
    assert.equal(result.days.length, 62);
    assert.equal(result.days[0].date, "2024-11-01");
    assert.equal(result.days.at(-1).date, "2025-01-01");
    assertData(result.months, [
      { month: "2024-11", revenue: 5, transactionCount: 1, isCurrentMonth: false },
      { month: "2024-12", revenue: 0, transactionCount: 0, isCurrentMonth: false },
      { month: "2025-01", revenue: 0.01, transactionCount: 1, isCurrentMonth: true },
    ]);
  } finally {
    restoreTimezone(originalTimezone);
  }
});

test("empty sales return zero buckets and a bounded single Sale query", async () => {
  let queryCount = 0;
  prisma.sale.findMany = async (query) => {
    queryCount += 1;
    assertData(query.select, { createdAt: true, totalAmount: true });
    return [];
  };
  const result = await sales.getSalesPerformance(new Date("2026-10-08T04:00:00.000Z"));
  assert.equal(queryCount, 1);
  assert.equal(result.period.fromInput, "2026-08-01");
  assert.equal(result.period.toInput, "2026-10-08");
  assert.equal(result.days.length, 69);
  assert.ok(result.days.every((day) => day.revenue === 0 && day.transactionCount === 0));
  assert.equal(result.months.length, 3);
  assert.ok(result.months.every((month) => month.revenue === 0 && month.transactionCount === 0));
  assert.equal(result.months.at(-1).isCurrentMonth, true);
});

test("custom performance range queries historical days with Singapore-inclusive bounds", async () => {
  let query;
  prisma.sale.findMany = async (value) => {
    query = value;
    return [
      { createdAt: new Date("2025-01-01T16:00:00.000Z"), totalAmount: "12.50" },
      { createdAt: new Date("2025-01-03T15:59:59.999Z"), totalAmount: "2.25" },
    ];
  };
  const period = sales.buildSalesPeriodFilter("2025-01-02", "2025-01-03");
  const result = await sales.getSalesPerformance(new Date("2026-10-08T04:00:00.000Z"), period);

  assert.equal(query.where.createdAt.gte.toISOString(), "2025-01-01T16:00:00.000Z");
  assert.equal(query.where.createdAt.lte.toISOString(), "2025-01-03T15:59:59.999Z");
  assertData(result.days, [
    { date: "2025-01-02", revenue: 12.5, transactionCount: 1 },
    { date: "2025-01-03", revenue: 2.25, transactionCount: 1 },
  ]);
});

test("selected today is capped at now, future starts are rejected, and ranges over 366 days fail", async () => {
  let queryCount = 0;
  prisma.sale.findMany = async (query) => {
    queryCount += 1;
    assert.equal(query.where.createdAt.lte.toISOString(), "2026-10-08T04:00:00.000Z");
    return [];
  };
  const now = new Date("2026-10-08T04:00:00.000Z");
  const throughToday = sales.buildSalesPeriodFilter("2026-10-08", "2026-10-08");
  const result = await sales.getSalesPerformance(now, throughToday);
  assert.equal(result.days.length, 1);
  assert.equal(queryCount, 1);

  const throughFuture = sales.buildSalesPeriodFilter("2026-10-08", "2026-10-10");
  const capped = await sales.getSalesPerformance(now, throughFuture);
  assert.equal(capped.period.toInput, "2026-10-08");
  assert.equal(capped.days.length, 1);
  assert.equal(queryCount, 2);

  const futureStart = sales.buildSalesPeriodFilter("2026-10-09", "2026-10-10");
  await assert.rejects(
    sales.getSalesPerformance(now, futureStart),
    (error) => error.status === 400
  );
  assert.equal(queryCount, 2);

  const tooLong = sales.buildSalesPeriodFilter("2025-01-01", "2026-01-02");
  assert.throws(
    () => sales.validateSalesPerformanceRange(tooLong),
    (error) => error.status === 400
  );
});

test("sales performance endpoint authenticates before validating and rejects ranges over 366 days", async () => {
  const calls = { auth: 0, performance: 0 };
  let admin = null;
  class RouteApiError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }
  const route = loadTypeScript("app/api/sales/performance/route.ts", {
    "@/lib/api-helpers": {
      ApiError: RouteApiError,
      apiResponse: (data, status = 200) => Response.json({ success: true, data }, { status }),
      requireAdmin: async () => {
        calls.auth += 1;
        if (!admin) throw Object.assign(new Error("Unauthorized"), { status: 401 });
        if (admin.role !== "ADMIN") throw Object.assign(new Error("Forbidden"), { status: 403 });
      },
      withErrorHandler: (handler) => async (...args) => {
        try { return await handler(...args); }
        catch (error) { return Response.json({ success: false, error: error.message }, { status: error.status || 500 }); }
      },
    },
    "@/lib/sales": {
      buildSalesPeriodFilter: sales.buildSalesPeriodFilter,
      getSalesPerformance: async (_now, period) => {
        sales.validateSalesPerformanceRange(period);
        calls.performance += 1;
        return { period, days: [], months: [] };
      },
    },
  });

  let response = await route.GET(new Request("http://local/api/sales/performance"));
  assert.equal(response.status, 401);
  assert.equal(calls.performance, 0);

  admin = { role: "ADMIN" };
  response = await route.GET(new Request("http://local/api/sales/performance?from=2025-01-01"));
  assert.equal(response.status, 400);
  assert.equal(calls.performance, 0);

  response = await route.GET(new Request("http://local/api/sales/performance?from=2025-01-01&to=2026-01-02"));
  assert.equal(response.status, 400, JSON.stringify(await response.clone().json()));
  assert.equal(calls.performance, 0);

  admin = { role: "PEGAWAI" };
  response = await route.GET(new Request("http://local/api/sales/performance?from=2026-10-01&to=2026-10-08"));
  assert.equal(response.status, 403);
  assert.equal(calls.performance, 0);

  admin = { role: "ADMIN" };
  response = await route.GET(new Request("http://local/api/sales/performance?from=2026-10-10&to=2026-10-08"));
  assert.equal(response.status, 400);
  assert.equal(calls.performance, 0);

  response = await route.GET(new Request("http://local/api/sales/performance?from=2026-10-01&to=2026-10-08"));
  assert.equal(response.status, 200);
  assert.equal(calls.performance, 1);
});

test("dashboard scopes chart query errors and excludes employee sales payloads", async () => {
  const db = {
    product: { count: async () => 3 },
    productVariant: {
      count: async () => 4,
      aggregate: async () => ({ _sum: { stock: 20 } }),
      findMany: async () => [],
      fields: { minStock: "minStock" },
    },
    stockIn: { aggregate: async () => ({ _sum: { quantity: 1 } }), findMany: async () => [] },
    stockOut: { aggregate: async () => ({ _sum: { quantity: 2 } }), findMany: async () => [] },
  };
  const report = {
    period: { fromInput: "2026-10-08", toInput: "2026-10-08" },
    revenue: 7,
    transactionCount: 1,
    itemCount: 1,
    latestSales: [],
  };
  const salesModule = {
    REPORT_TIMEZONE: "Asia/Singapore",
    buildSalesPeriodFilter: () => ({ from: new Date(0), to: new Date(1), fromInput: "2026-10-08", toInput: "2026-10-08" }),
    getSalesReport: async () => report,
    getSalesPerformance: async () => { throw new Error("database details stay private"); },
  };
  const dashboard = loadTypeScript("lib/dashboard-data.ts", {
    "@/lib/prisma": { __esModule: true, default: db },
    "@/lib/sales": salesModule,
    "@/lib/stock-transactions": {
      mergeStockTransactions: () => [],
      stockInTransactionInclude: {},
      stockOutTransactionInclude: {},
    },
  });

  const admin = await dashboard.getDashboardData({ includeOwnerTotals: true });
  assert.equal(admin.salesPerformance, null);
  assert.equal(admin.salesPerformanceError, "Gagal memuat performa penjualan.");
  assert.deepEqual(admin.salesReport, report);
  assert.equal(admin.totals.products, 3);

  const employee = await dashboard.getDashboardData({ includeOwnerTotals: false });
  assert.equal(employee.salesPerformance, null);
  assert.equal(employee.salesPerformanceError, null);
  assert.equal(employee.salesReport, null);
  assert.equal(employee.totals, null);
});
