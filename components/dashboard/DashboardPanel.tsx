import Link from "next/link";
import type { ReactNode } from "react";
import type { DashboardIcon } from "@/types/dashboard";

export function DashboardPanel({
  icon,
  title,
  actionHref,
  actionLabel,
  children,
}: {
  icon: DashboardIcon;
  title: string;
  actionHref: string;
  actionLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]">
      <div className="flex items-center justify-between gap-3 border-b border-[#c5c0b1] bg-[#eceae3]/35 p-4">
        <div className="flex items-center gap-2 text-[#201515]">
          <span className="text-[#ff4f00]">{icon}</span>
          <h2 className="text-[16px] font-bold">{title}</h2>
        </div>
        <Link
          href={actionHref}
          className="rounded-[20px] border border-[#c5c0b1] bg-[#fffefb] px-3 py-1.5 text-[12px] font-bold text-[#201515] transition-colors hover:bg-[#eceae3]"
        >
          {actionLabel}
        </Link>
      </div>
      {children}
    </div>
  );
}

export function DashboardMiniMetric({
  label,
  value,
  urgent,
}: {
  label: string;
  value: string;
  urgent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] p-3 sm:border-0 sm:bg-transparent sm:p-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
        {label}
      </p>
      <p
        className={`mt-1 text-[18px] font-bold leading-none ${
          urgent ? "text-[#ff4f00]" : "text-[#201515]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function DashboardEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="p-8 text-center">
      <p className="text-[16px] font-bold text-[#201515]">{title}</p>
      <p className="mx-auto mt-1 max-w-[320px] text-[14px] leading-[1.35] text-[#939084]">
        {description}
      </p>
    </div>
  );
}
