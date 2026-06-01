import Link from "next/link";
import { AlertCircle } from "lucide-react";
import {
  formatDashboardVariation,
} from "@/lib/dashboard-format";
import {
  DashboardEmptyState,
  DashboardPanel,
} from "@/components/dashboard/DashboardPanel";
import type { LowStockVariant } from "@/types/dashboard";

export function LowStockPanel({
  variants,
}: {
  variants: LowStockVariant[];
}) {
  return (
    <DashboardPanel
      icon={<AlertCircle className="h-5 w-5" />}
      title="Peringatan Stok Rendah"
      actionHref="/products"
      actionLabel="Lihat Produk"
    >
      <div className="divide-y divide-[#eceae3]">
        {variants.length === 0 ? (
          <DashboardEmptyState
            title="Semua stok aman"
            description="Belum ada SKU aktif yang menyentuh batas minimum."
          />
        ) : (
          variants.map((variant) => (
            <Link
              href={`/products/${variant.productId}`}
              key={variant.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-l-4 border-l-[#ff4f00] p-4 transition-colors hover:bg-[#eceae3]/30"
            >
              <div className="min-w-0">
                <p className="truncate text-[16px] font-bold text-[#201515]">
                  {variant.sku}
                </p>
                <p className="mt-1 truncate text-[13px] font-semibold text-[#36342e]">
                  {variant.product.name}
                </p>
                <p className="truncate text-[13px] text-[#939084]">
                  {formatDashboardVariation(variant.values)}
                </p>
              </div>
              <div className="flex flex-col items-end justify-start gap-1 text-right">
                <p
                  className={`text-[13px] font-bold uppercase leading-none ${
                    variant.stock <= variant.minStock
                      ? "text-[#ff4f00]"
                      : "text-[#201515]"
                  }`}
                >
                  Stok saat ini {variant.stock}
                </p>
                <p className="text-[13px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
                  minimum {variant.minStock}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </DashboardPanel>
  );
}
