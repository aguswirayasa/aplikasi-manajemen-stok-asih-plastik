import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function DashboardHeader({ displayName }: { displayName: string }) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
          Ringkasan operasional
        </p>
        <h1 className="mt-1 text-[30px] font-semibold leading-[1] text-[#201515] md:text-[36px]">
          Dashboard Stok
        </h1>
        <p className="mt-2 max-w-[640px] text-[15px] leading-[1.25] text-[#36342e]">
          Selamat datang,{" "}
          <span className="font-bold text-[#201515]">{displayName}</span>.
          Pantau SKU aktif, pergerakan hari ini, dan stok yang perlu
          ditindaklanjuti.
        </p>
      </div>
      <Link
        href="/stock/out"
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[5px] border border-[#ff4f00] bg-[#ff4f00] px-5 text-[15px] font-bold text-[#fffefb] transition-colors hover:bg-[#e64600] md:w-auto"
      >
        <ArrowUpRight className="h-4 w-4" />
        Catat Stok Keluar
      </Link>
    </header>
  );
}
