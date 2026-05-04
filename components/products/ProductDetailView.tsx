import Link from "next/link";
import { ArrowLeft, Edit2 } from "lucide-react";
import { ProductStockStatus } from "@/components/products/ProductStockStatus";
import type { ProductStockStatus as ProductStockStatusData } from "@/lib/product-summary";

export type ProductDetailVariant = {
  id: string;
  sku: string;
  price: number;
  stock: number;
  minStock: number;
  isActive: boolean;
  values: {
    value: string;
    typeName?: string;
  }[];
};

export type ProductDetailMovement = {
  id: string;
  type: "IN" | "OUT";
  sku: string;
  quantity: number;
  note: string | null;
  userName: string;
  createdAt: Date;
};

export type ProductDetailViewProduct = {
  id: string;
  name: string;
  description: string | null;
  categoryName: string;
  createdAt: Date;
  updatedAt: Date;
  variants: ProductDetailVariant[];
};

type ProductDetailViewProps = {
  product: ProductDetailViewProduct;
  summary: {
    totalVariants: number;
    totalStock: number;
    stockStatus: ProductStockStatusData;
  };
  recentMovements: ProductDetailMovement[];
  canEdit: boolean;
};

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function ProductDetailView({
  product,
  summary,
  recentMovements,
  canEdit,
}: ProductDetailViewProps) {
  const minimumSummary = getMinimumStockSummary(product.variants);

  return (
    <div className="min-h-screen bg-[#fffefb] text-[#201515] pb-24 md:pb-8 font-sans">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 md:py-10">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-[#939084] hover:text-[#201515] transition-colors font-medium mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Produk
        </Link>

        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h1 className="text-[32px] md:text-[40px] font-medium leading-[0.95] tracking-tight mb-2 break-words">
              {product.name}
            </h1>
            <p className="text-[#36342e] text-[16px] leading-[1.25]">
              {product.categoryName}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:flex md:flex-wrap md:justify-end">
            {canEdit && (
              <Link
                href={`/products/${product.id}/edit`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-4 text-[14px] font-bold text-[#201515] hover:bg-[#eceae3]"
              >
                <Edit2 className="h-4 w-4" /> Edit
              </Link>
            )}
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Total Stok"
            value={summary.totalStock.toString()}
          />
          <SummaryCard
            label="Jumlah Varian"
            value={summary.totalVariants.toString()}
          />
          <div className="rounded-[8px] border border-[#c5c0b1] bg-[#fffefb] p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
              Status Stok
            </p>
            <div className="mt-2">
              <ProductStockStatus
                status={summary.stockStatus}
                detail="comfortable"
              />
            </div>
          </div>
          <SummaryCard label="Minimum Stok" value={minimumSummary} />
        </section>

        {product.description && (
          <section className="mb-6 rounded-[8px] border border-[#c5c0b1] bg-[#fffefb] p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
              Deskripsi
            </p>
            <p className="mt-2 text-[15px] leading-[1.4] text-[#36342e]">
              {product.description}
            </p>
          </section>
        )}

        <VariantSection variants={product.variants} />

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <RecentStockMovements movements={recentMovements} />

          <div className="rounded-[8px] border border-[#c5c0b1] bg-[#fffefb] p-4">
            <h2 className="text-[18px] font-semibold text-[#201515]">
              Metadata
            </h2>
            <div className="mt-4 space-y-3">
              <MetadataRow
                label="Dibuat"
                value={dateFormatter.format(product.createdAt)}
              />
              <MetadataRow
                label="Diperbarui"
                value={dateFormatter.format(product.updatedAt)}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function VariantSection({ variants }: { variants: ProductDetailVariant[] }) {
  return (
    <section className="mb-6 overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]">
      <div className="border-b border-[#c5c0b1] bg-[#eceae3]/50 p-4">
        <h2 className="text-[18px] font-semibold text-[#201515]">
          Daftar Varian
        </h2>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#c5c0b1]">
              <th className="p-4 font-semibold text-[#201515]">SKU</th>
              <th className="p-4 font-semibold text-[#201515]">Variasi</th>
              <th className="p-4 font-semibold text-[#201515]">Harga</th>
              <th className="p-4 font-semibold text-[#201515]">Stok</th>
              <th className="p-4 font-semibold text-[#201515]">Min.</th>
              <th className="p-4 font-semibold text-[#201515]">Status</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant) => (
              <tr
                key={variant.id}
                className="border-b border-[#c5c0b1] last:border-0"
              >
                <td className="p-4 font-bold text-[#201515]">{variant.sku}</td>
                <td className="p-4 text-[#36342e]">
                  {formatVariantValues(variant.values)}
                </td>
                <td className="p-4 tabular-nums text-[#36342e]">
                  {currencyFormatter.format(variant.price)}
                </td>
                <td className="p-4 tabular-nums font-bold text-[#201515]">
                  {variant.stock}
                </td>
                <td className="p-4 tabular-nums text-[#36342e]">
                  {variant.minStock}
                </td>
                <td className="p-4">
                  <VariantStatus
                    stock={variant.stock}
                    minStock={variant.minStock}
                    isActive={variant.isActive}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-[#c5c0b1] md:hidden">
        {variants.map((variant) => (
          <article key={variant.id} className="space-y-3 p-4">
            <div>
              <div className="flex justify-between items-center">
                <p className="break-words text-[16px] font-bold text-[#201515]">
                  {variant.sku}
                </p>
                <VariantStatus
                  stock={variant.stock}
                  minStock={variant.minStock}
                  isActive={variant.isActive}
                />
              </div>
              <p className="mt-1 break-words text-[13px] text-[#939084]">
                {formatVariantValues(variant.values)}
              </p>
            </div>
            <div className="space-y-2">
              <Metric
                label="Harga"
                value={currencyFormatter.format(variant.price)}
              />
              <Metric label="Stok" value={variant.stock.toString()} />
              <Metric label="Min." value={variant.minStock.toString()} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RecentStockMovements({
  movements,
}: {
  movements: ProductDetailMovement[];
}) {
  return (
    <div className="rounded-[8px] border border-[#c5c0b1] bg-[#fffefb] p-4">
      <h2 className="text-[18px] font-semibold text-[#201515]">
        Riwayat Stok Terbaru
      </h2>
      <div className="mt-4 space-y-3">
        {movements.length === 0 ? (
          <p className="text-[14px] text-[#939084]">
            Belum ada pergerakan stok untuk produk ini.
          </p>
        ) : (
          movements.map((movement) => (
            <div
              key={`${movement.type}-${movement.id}`}
              className="flex items-start justify-between gap-4 rounded-[6px] border border-[#eceae3] p-3"
            >
              <div className="min-w-0">
                <p className="break-words text-[14px] font-bold text-[#201515]">
                  {movement.sku}
                </p>
                <p className="mt-1 text-[12px] text-[#939084]">
                  {movement.note || "Tanpa catatan"} - {movement.userName}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={`tabular-nums text-[16px] font-bold ${
                    movement.type === "IN"
                      ? "text-emerald-700"
                      : "text-[#ff4f00]"
                  }`}
                >
                  {movement.type === "IN" ? "+" : "-"}
                  {movement.quantity}
                </p>
                <p className="mt-1 text-[11px] text-[#939084]">
                  {dateFormatter.format(movement.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#c5c0b1] bg-[#fffefb] p-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
        {label}
      </p>
      <p className="mt-2 break-words text-[24px] font-bold leading-none text-[#201515] tabular-nums">
        {value}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[5px] border border-[#eceae3] bg-[#fffefb] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
        {label}
      </p>
      <p className="mt-1 break-words text-[14px] font-bold text-[#201515] tabular-nums">
        {value}
      </p>
    </div>
  );
}

function VariantStatus({
  stock,
  minStock,
  isActive,
}: {
  stock: number;
  minStock: number;
  isActive: boolean;
}) {
  if (!isActive) {
    return (
      <span className="inline-flex max-w-full rounded-[20px] bg-[#eceae3] px-2.5 py-1 text-[13px] font-semibold text-[#939084]">
        Nonaktif
      </span>
    );
  }

  const isLow = stock <= minStock;

  return (
    <span
      className={`inline-flex max-w-full rounded-[20px] px-2.5 py-1 text-[13px] font-semibold ${
        isLow
          ? "bg-[#ff4f00]/10 text-[#ff4f00]"
          : "bg-emerald-50 text-emerald-700"
      }`}
    >
      {isLow ? "Stok rendah" : "Stok aman"}
    </span>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-[14px]">
      <span className="font-semibold text-[#939084]">{label}</span>
      <span className="min-w-0 break-words text-right font-bold text-[#201515]">
        {value}
      </span>
    </div>
  );
}

function getMinimumStockSummary(
  variants: { stock: number; minStock: number }[],
) {
  if (variants.length === 0) {
    return "Tidak ada SKU";
  }

  const watchedVariants = variants.filter((variant) => variant.minStock > 0);
  const lowVariants = variants.filter(
    (variant) => variant.stock <= variant.minStock,
  );

  if (watchedVariants.length === 0) {
    return "Belum diatur";
  }

  return `${lowVariants.length}/${watchedVariants.length} perlu perhatian`;
}

function formatVariantValues(values: ProductDetailVariant["values"]) {
  const label = values
    .map((value) =>
      value.typeName ? `${value.typeName}: ${value.value}` : value.value,
    )
    .join(" / ");

  return label || "Tanpa variasi";
}
