import Link from "next/link";
import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Box,
  History,
  Package,
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatVariation(
  values: {
    variationValue: {
      value: string;
      variationType: { name: string };
    };
  }[]
) {
  return (
    values
      .map((item) => item.variationValue.value)
      .filter(Boolean)
      .join(" / ") || "-"
  );
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const data = await getDashboardData();
  const displayName = session.user.name || session.user.username;

  return (
    <div className="space-y-6 pb-8">
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

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Produk"
          value={data.totals.products}
          icon={<Package className="h-5 w-5" />}
        />
        <StatCard
          label="SKU Aktif"
          value={data.totals.activeSkus}
          icon={<Box className="h-5 w-5" />}
        />
        <StatCard
          label="Total Stok"
          value={data.totals.totalStock}
          icon={<ArrowDownLeft className="h-5 w-5" />}
        />
        <StatCard
          label="Stok Rendah"
          value={data.totals.lowStock}
          icon={<AlertCircle className="h-5 w-5" />}
          urgent={data.totals.lowStock > 0}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <TodayCard
          label="Barang masuk hari ini"
          value={data.today.stockIn}
          icon={<ArrowDownLeft className="h-5 w-5" />}
        />
        <TodayCard
          label="Barang keluar hari ini"
          value={data.today.stockOut}
          icon={<ArrowUpRight className="h-5 w-5" />}
        />
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
        <div className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]">
          <PanelHeader
            icon={<AlertCircle className="h-5 w-5" />}
            title="Peringatan Stok Rendah"
            actionHref="/products"
            actionLabel="Lihat Produk"
          />
          <div className="divide-y divide-[#eceae3]">
            {data.lowStockVariants.length === 0 ? (
              <EmptyState
                title="Semua stok aman"
                description="Belum ada SKU aktif yang menyentuh batas minimum."
              />
            ) : (
              data.lowStockVariants.map((variant) => (
                <Link
                  href={`/products/${variant.productId}`}
                  key={variant.id}
                  className="grid gap-3 border-l-4 border-l-[#ff4f00] p-4 transition-colors hover:bg-[#eceae3]/30 sm:grid-cols-[minmax(0,1fr)_120px]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-bold text-[#201515]">
                      {variant.sku}
                    </p>
                    <p className="mt-1 truncate text-[13px] font-semibold text-[#36342e]">
                      {variant.product.name}
                    </p>
                    <p className="truncate text-[13px] text-[#939084]">
                      {formatVariation(variant.values)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:block sm:text-right">
                    <MiniMetric
                      label="Stok"
                      value={`${variant.stock}`}
                      urgent={variant.stock <= variant.minStock}
                    />
                    <MiniMetric label="Minimum" value={`${variant.minStock}`} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]">
          <PanelHeader
            icon={<History className="h-5 w-5" />}
            title="Transaksi Terbaru"
            actionHref="/stock/history"
            actionLabel="Riwayat"
          />
          <div className="divide-y divide-[#eceae3]">
            {data.recentTransactions.length === 0 ? (
              <EmptyState
                title="Belum ada transaksi"
                description="Stok masuk dan keluar terbaru akan tampil di sini."
              />
            ) : (
              data.recentTransactions.map((transaction) => (
                <article
                  key={`${transaction.type}-${transaction.id}`}
                  className="grid grid-cols-[40px_minmax(0,1fr)_auto] gap-3 p-4"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-[5px] border border-[#c5c0b1] text-[#ff4f00]">
                    {transaction.type === "IN" ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-[#201515]">
                      {transaction.variant.sku}
                    </p>
                    <p className="truncate text-[13px] text-[#36342e]">
                      {transaction.variant.product.name}
                    </p>
                    <p className="mt-1 text-[12px] text-[#939084]">
                      {dateFormatter.format(transaction.createdAt)} oleh{" "}
                      {transaction.user.name || transaction.user.username}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[20px] font-bold leading-none text-[#201515]">
                      {transaction.type === "IN" ? "+" : "-"}
                      {transaction.quantity}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
                      Qty
                    </p>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
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
  icon: ReactNode;
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

function TodayCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
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

function PanelHeader({
  icon,
  title,
  actionHref,
  actionLabel,
}: {
  icon: ReactNode;
  title: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
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
  );
}

function MiniMetric({
  label,
  value,
  urgent,
}: {
  label: string;
  value: string;
  urgent?: boolean;
}) {
  return (
    <div className="rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] p-3 sm:border-0 sm:bg-transparent sm:p-0">
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

function EmptyState({
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
