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
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
}: {
  label: string;
  value: number;
  icon: DashboardIcon;
  urgent?: boolean;
}) {
  return (
    <article className="rounded-[8px] border border-[#c5c0b1] bg-[#fffefb] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
          {label}
        </p>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-[5px] border ${
            urgent
              ? "border-[#ff4f00] text-[#ff4f00]"
              : "border-[#c5c0b1] text-[#ff4f00]"
          }`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-5 text-[34px] font-bold leading-none text-[#201515]">
        {value}
      </p>
    </article>
  );
}
