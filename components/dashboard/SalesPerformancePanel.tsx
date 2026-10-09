"use client";

import { useState, type FormEvent } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import type { ApiResponse } from "@/lib/api-helpers";
import type { SalesPerformance } from "@/lib/sales";

const preciseCurrency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compactAxisCurrency = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const chartConfig = {
  revenue: { label: "Omzet", color: "#ff4f00" },
} satisfies ChartConfig;
const DAY_MILLISECONDS = 86_400_000;

type DateRange = { from: string; to: string };
function defaultDateRange(performance: SalesPerformance | null): DateRange {
  if (performance) {
    return {
      from: performance.period.fromInput,
      to: performance.period.toInput,
    };
  }

  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(dateParts.find((part) => part.type === "year")?.value);
  const month = Number(dateParts.find((part) => part.type === "month")?.value);
  const day = dateParts.find((part) => part.type === "day")?.value ?? "01";
  const firstMonth = new Date(Date.UTC(year, month - 3, 1));

  return {
    from: `${firstMonth.getUTCFullYear()}-${String(firstMonth.getUTCMonth() + 1).padStart(2, "0")}-01`,
    to: `${year}-${String(month).padStart(2, "0")}-${day}`,
  };
}

export function SalesPerformancePanel({
  performance: initialPerformance,
  error: initialError,
}: {
  performance: SalesPerformance | null;
  error: string | null;
}) {
  const [range, setRange] = useState(() =>
    defaultDateRange(initialPerformance),
  );
  const [performance, setPerformance] = useState(initialPerformance);
  const [fetchError, setFetchError] = useState(initialError);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function showRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRangeError(null);
    setFetchError(null);

    if (!range.from || !range.to || range.from > range.to) {
      setRangeError("Tanggal awal tidak boleh melewati tanggal akhir.");
      return;
    }

    const days =
      (Date.parse(`${range.to}T00:00:00Z`) -
        Date.parse(`${range.from}T00:00:00Z`)) /
        DAY_MILLISECONDS +
      1;
    if (days > 366) {
      setRangeError("Rentang tanggal maksimal 1 tahun (366 hari).");
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams(range);
      const response = await fetch(`/api/sales/performance?${params}`);
      const result = (await response.json()) as ApiResponse<SalesPerformance>;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || "Gagal memuat performa penjualan.");
      }

      setPerformance(result.data);
    } catch (caught: unknown) {
      setFetchError(
        caught instanceof Error
          ? caught.message
          : "Gagal memuat performa penjualan.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const maxDate = defaultDateRange(null).to;

  return (
    <section className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]">
      <div className="border-b border-[#c5c0b1] bg-[#eceae3]/35 p-4">
        <h2 className="text-[18px] font-bold text-[#201515]">
          Performance penjualan toko
        </h2>
        {performance && (
          <p className="text-[13px] text-[#939084]">
            Omzet harian {performance.period.fromInput} sampai{" "}
            {performance.period.toInput}.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 p-4">
        <form className="flex flex-wrap items-end gap-3" onSubmit={showRange}>
          <div className="grid min-w-40 flex-1 gap-1.5">
            <label
              className="text-[13px] font-semibold text-[#514d40]"
              htmlFor="sales-from"
            >
              Tanggal awal
            </label>
            <Input
              id="sales-from"
              type="date"
              max={maxDate}
              value={range.from}
              disabled={isLoading}
              onChange={(event) =>
                setRange({ ...range, from: event.target.value })
              }
              required
            />
          </div>
          <div className="grid min-w-40 flex-1 gap-1.5">
            <label
              className="text-[13px] font-semibold text-[#514d40]"
              htmlFor="sales-to"
            >
              Tanggal akhir
            </label>
            <Input
              id="sales-to"
              type="date"
              max={maxDate}
              value={range.to}
              disabled={isLoading}
              onChange={(event) =>
                setRange({ ...range, to: event.target.value })
              }
              required
            />
          </div>
          <Button
            className="min-w-28 bg-[#ff4f00]"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Memuat…" : fetchError ? "Coba lagi" : "Tampilkan"}
          </Button>
          <p className="w-full text-[12px] text-[#777568]">
            Rentang maksimal 1 tahun (366 hari).
          </p>
        </form>

        {(rangeError || fetchError) && (
          <p className="text-[14px] text-[#6f321f]" role="alert">
            {rangeError || fetchError}
          </p>
        )}

        {performance?.days.length ? (
          <ChartContainer
            config={chartConfig}
            className="h-[280px] w-full aspect-auto"
            aria-label="Grafik omzet penjualan harian"
          >
            <LineChart
              accessibilityLayer
              data={performance.days}
              margin={{ top: 12, right: 12, bottom: 8, left: 12 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 4" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                height={40}
                minTickGap={24}
                tickFormatter={(date: string) => date.slice(5)}
                label={{
                  value: "Tanggal",
                  position: "insideBottom",
                  offset: 0,
                }}
              />
              <YAxis
                width={104}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value: number) =>
                  `Rp ${compactAxisCurrency.format(value)}`
                }
                label={{
                  value: "Omzet (Rp)",
                  angle: -90,
                  position: "insideLeft",
                  offset: 10,
                }}
              />
              <ChartTooltip
                cursor={{ stroke: "#c5c0b1", strokeDasharray: "3 4" }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(date) => `Tanggal ${String(date)}`}
                    formatter={(value, _name, item) => (
                      <div className="flex flex-1 justify-between gap-4">
                        <span>{preciseCurrency.format(Number(value))}</span>
                        <span className="text-muted-foreground">
                          {item.payload.transactionCount} transaksi
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-revenue)"
                strokeWidth={3}
                dot={false}
                isAnimationActive={false}
                activeDot={{
                  r: 6,
                  fill: "#201515",
                  stroke: "#fffefb",
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <p className="text-[14px] text-[#514d40]" aria-live="polite">
            {performance
              ? "Data harian tidak tersedia."
              : "Grafik penjualan belum tersedia."}
          </p>
        )}
      </div>
    </section>
  );
}
