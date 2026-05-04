import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type {
  DashboardData,
  DashboardIcon,
} from "@/types/dashboard";

export function DashboardTodayCards({ today }: { today: DashboardData["today"] }) {
  return (
    <section className="grid gap-3 md:grid-cols-2">
      <TodayCard
        label="Barang masuk hari ini"
        value={today.stockIn}
        icon={<ArrowDownLeft className="h-5 w-5" />}
      />
      <TodayCard
        label="Barang keluar hari ini"
        value={today.stockOut}
        icon={<ArrowUpRight className="h-5 w-5" />}
      />
    </section>
  );
}

function TodayCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: DashboardIcon;
}) {
  return (
    <article className="flex items-center justify-between gap-4 rounded-[8px] border border-[#c5c0b1] bg-[#eceae3]/35 p-4">
      <div>
        <p className="text-[13px] font-semibold text-[#36342e]">{label}</p>
        <p className="mt-1 text-[28px] font-bold leading-none text-[#201515]">
          {value}
        </p>
      </div>
      <span className="flex h-11 w-11 items-center justify-center rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] text-[#ff4f00]">
        {icon}
      </span>
    </article>
  );
}
