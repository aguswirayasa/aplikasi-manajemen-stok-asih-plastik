import type { LowStockVariant } from "@/types/dashboard";

export const dashboardDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDashboardVariation(values: LowStockVariant["values"]) {
  return (
    values
      .map((item) => item.variationValue.value)
      .filter(Boolean)
      .join(" / ") || "-"
  );
}
