import { AlertCircle, ArrowDownLeft, Box, Package } from "lucide-react";
import type {
  DashboardData,
  DashboardIcon,
} from "@/types/dashboard";

export function DashboardStatCards({
  totals,
}: {
  totals: NonNullable<DashboardData["totals"]>;
}) {
  return (
    <section className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
      <StatCard
        label="Produk"
        value={totals.products}
        icon={<Package className="h-5 w-5" />}
      />
      <StatCard
        label="SKU Aktif"
        value={totals.activeSkus}
        icon={<Box className="h-5 w-5" />}
      />
      <StatCard
        label="Total Stok"
        value={totals.totalStock}
        icon={<ArrowDownLeft className="h-5 w-5" />}
      />
      <StatCard
        label="Stok Rendah"
        value={totals.lowStock}
        unit="SKU"
        icon={<AlertCircle className="h-5 w-5" />}
        urgent={totals.lowStock > 0}
      />
    </section>
  );
}

function StatCard({
  label,
  value,
  icon,
  urgent,
  unit,
}: {
  label: string;
  value: number;
  icon: DashboardIcon;
  urgent?: boolean;
  unit?: string;
}) {
  return (
    <article className="rounded-[8px] border border-[#c5c0b1] bg-[#fffefb] p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#939084] sm:text-[12px]">
          {label}
        </p>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] border sm:h-9 sm:w-9 ${
            urgent
              ? "border-[#ff4f00] text-[#ff4f00]"
              : "border-[#c5c0b1] text-[#ff4f00]"
          }`}
        >
          <span className="[&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5">
            {icon}
          </span>
        </span>
      </div>
      <p className="mt-3 text-[26px] font-bold leading-none text-[#201515] sm:mt-5 sm:text-[34px]">
        {value}
        {unit && (
          <span className="ml-1 text-[13px] font-semibold text-[#939084] sm:ml-1.5 sm:text-[16px]">
            {unit}
          </span>
        )}
      </p>
    </article>
  );
}
