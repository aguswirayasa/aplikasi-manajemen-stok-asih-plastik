"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { buildStockHistoryQuery } from "@/lib/stock-history-utils";
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

export function SalesPerformancePanel({
  performance,
  error,
}: {
  performance: SalesPerformance | null;
  error: string | null;
}) {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max((performance?.days.length || 1) - 1, 0),
  );

  if (error || !performance) {
    return (
      <section className="rounded-[8px] border border-[#c5c0b1] bg-[#fffefb] p-4">
        <h2 className="text-[18px] font-bold text-[#201515]">
          Performa Penjualan 3 Bulan
        </h2>
        <p className="mt-2 text-[14px] text-[#6f321f]" role="alert">
          {error || "Gagal memuat performa penjualan."}
        </p>
        <button
          className="mt-3 rounded-[5px] border border-[#c5c0b1] px-3 py-2 text-[14px] font-semibold text-[#201515] hover:bg-[#eceae3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff4f00]"
          type="button"
          onClick={() => router.refresh()}
        >
          Coba lagi
        </button>
      </section>
    );
  }

  const selectedIndexSafe = Math.min(
    selectedIndex,
    performance.days.length - 1,
  );
  const selected = performance.days[selectedIndexSafe];
  const hasDays = Boolean(selected);
  const selectedQuery = buildStockHistoryQuery({
    type: "sales",
    fromInput: selected?.date || performance.period.toInput,
    toInput: selected?.date || performance.period.toInput,
  });
  const hasSales = performance.days.some((day) => day.transactionCount > 0);

  return (
    <section className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]">
      <div className="border-b border-[#c5c0b1] bg-[#eceae3]/35 p-4">
        <h2 className="text-[18px] font-bold text-[#201515]">
          Performa Penjualan 3 Bulan
        </h2>
        <p className="text-[13px] text-[#939084]">
          Omzet dan jumlah transaksi harian sejak {performance.period.fromInput}
          .
        </p>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {performance.months.map((month) => (
            <article
              className="min-w-0 rounded-[5px] border border-[#c5c0b1] bg-[#eceae3]/30 p-3"
              key={month.month}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#777568]">
                {month.month}
                {month.isCurrentMonth ? " · Bulan berjalan" : ""}
              </p>
              <p className="mt-1 break-words text-[16px] font-bold text-[#201515]">
                {preciseCurrency.format(month.revenue)}
              </p>
              <p className="text-[13px] text-[#777568]">
                {month.transactionCount} transaksi
              </p>
            </article>
          ))}
        </div>

        {!hasSales && (
          <p className="rounded-[5px] bg-[#eceae3]/40 p-3 text-[14px] text-[#514d40]">
            Belum ada penjualan pada periode ini.
          </p>
        )}

        <div aria-label="Grafik omzet harian" role="group">
          {hasDays ? (
            <ChartContainer
              config={chartConfig}
              className="h-[280px] w-full aspect-auto"
              aria-label="Omzet penjualan harian. Arahkan atau pilih titik untuk melihat tanggal, omzet, dan transaksi."
            >
              <LineChart
                accessibilityLayer
                data={performance.days}
                margin={{ top: 12, right: 12, bottom: 8, left: 12 }}
                onClick={(state) => {
                  if (state?.activeTooltipIndex == null) return;
                  const index = Number(state.activeTooltipIndex);
                  if (
                    Number.isInteger(index) &&
                    index >= 0 &&
                    index < performance.days.length
                  ) {
                    setSelectedIndex(index);
                  }
                }}
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
                  width={76}
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
            <p className="rounded-[5px] bg-[#eceae3]/40 p-3 text-[14px] text-[#514d40]">
              Data harian tidak tersedia.
            </p>
          )}
        </div>

        <div className="grid max-w-sm gap-1">
          <label
            className="text-[13px] font-semibold text-[#514d40]"
            htmlFor="sales-day-selector"
          >
            Pilih tanggal
          </label>
          <select
            className="min-h-11 rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[14px] text-[#201515] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff4f00]"
            id="sales-day-selector"
            value={selected?.date || ""}
            disabled={!hasDays}
            onChange={(event) => {
              const index = performance.days.findIndex(
                (day) => day.date === event.target.value,
              );
              if (index >= 0) setSelectedIndex(index);
            }}
          >
            {performance.days.map((day) => (
              <option key={day.date} value={day.date}>
                {day.date}
              </option>
            ))}
          </select>
        </div>

        {selected && (
          <div
            className="rounded-[5px] border border-[#c5c0b1] bg-[#eceae3]/30 p-4"
            aria-live="polite"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#777568]">
              {selected.date}
            </p>
            <p className="mt-1 break-words text-[20px] font-bold text-[#201515]">
              {preciseCurrency.format(selected.revenue)}
            </p>
            <p className="text-[14px] text-[#514d40]">
              {selected.transactionCount} transaksi
            </p>
            <a
              className="mt-3 inline-flex rounded-[5px] bg-[#ff4f00] px-3 py-2 text-[14px] font-semibold text-white hover:bg-[#dc4600] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#201515]"
              href={`/stock/history${selectedQuery}`}
            >
              Lihat transaksi
            </a>
          </div>
        )}

        <details className="rounded-[5px] border border-[#c5c0b1]">
          <summary className="cursor-pointer px-4 py-3 text-[14px] font-semibold text-[#201515] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff4f00]">
            Lihat tabel data harian
          </summary>
          <div className="max-h-80 overflow-auto border-t border-[#c5c0b1]">
            <table className="w-full min-w-[540px] text-left text-[13px]">
              <caption className="sr-only">
                Omzet dan transaksi penjualan per hari
              </caption>
              <thead className="sticky top-0 bg-[#eceae3] text-[#514d40]">
                <tr>
                  <th className="px-3 py-2" scope="col">
                    Tanggal
                  </th>
                  <th className="px-3 py-2 text-right" scope="col">
                    Omzet
                  </th>
                  <th className="px-3 py-2 text-right" scope="col">
                    Transaksi
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Riwayat
                  </th>
                </tr>
              </thead>
              <tbody>
                {performance.days.map((day, index) => {
                  const query = buildStockHistoryQuery({
                    type: "sales",
                    fromInput: day.date,
                    toInput: day.date,
                  });
                  return (
                    <tr className="border-t border-[#e3dfd3]" key={day.date}>
                      <th className="px-3 py-2 font-medium" scope="row">
                        <button
                          className="rounded-sm text-left underline decoration-dotted underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff4f00]"
                          type="button"
                          aria-pressed={selectedIndexSafe === index}
                          onClick={() => setSelectedIndex(index)}
                        >
                          {day.date}
                        </button>
                      </th>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {preciseCurrency.format(day.revenue)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {day.transactionCount}
                      </td>
                      <td className="px-3 py-2">
                        <a
                          className="underline decoration-dotted underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff4f00]"
                          href={`/stock/history${query}`}
                        >
                          Lihat
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  );
}
