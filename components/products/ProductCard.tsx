import Link from "next/link";
import { Archive, Edit2, Eye } from "lucide-react";
import { getProductSummary } from "@/lib/product-summary";
import { ProductStockStatus } from "@/components/products/ProductStockStatus";
import { ProductDeleteAction } from "@/components/products/ProductDeleteAction";
import { ProductRestoreAction } from "@/components/products/ProductRestoreAction";

type ProductCardProduct = {
  id: string;
  name: string;
  isArchived: boolean;
  category: {
    name: string;
  };
  variants: {
    sku?: string;
    stock: number;
    minStock: number;
    values?: {
      variationValue: {
        value: string;
      };
    }[];
  }[];
};

export function ProductCard({
  product,
  canEdit = false,
}: {
  product: ProductCardProduct;
  canEdit?: boolean;
}) {
  const { totalVariants, totalStock, stockStatus } = getProductSummary(product);
  const canManageActiveProduct = canEdit && !product.isArchived;

  return (
    <div className="border border-[#c5c0b1] rounded-[8px] bg-[#fffefb] p-4 flex flex-col gap-3">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h3 className="text-[18px] font-semibold text-[#201515] leading-tight mb-1">
            {product.name}
          </h3>
          <p className="text-[14px] text-[#939084]">
            {product.category.name} - {totalVariants} SKUs
          </p>
        </div>
      </div>

      <div className="rounded-[6px] border border-[#eceae3] bg-[#fffefb] px-3 py-2">
        {product.isArchived ? (
          <span className="inline-flex items-center gap-2 rounded-[20px] bg-[#eceae3] px-3 py-1 text-[13px] font-semibold text-[#6f6a5f]">
            <Archive className="h-4 w-4" />
            Diarsipkan
          </span>
        ) : (
          <ProductStockStatus status={stockStatus} detail="comfortable" />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eceae3] pt-3 mt-1">
        <div className="text-[14px]">
          <span className="text-[#939084]">Total Stok:</span>{" "}
          <span className="font-bold text-[#201515]">{totalStock}</span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Link
            href={`/products/${product.id}`}
            aria-label={`Lihat detail ${product.name}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#c5c0b1] rounded-[4px] text-[14px] font-semibold text-[#201515] hover:bg-[#eceae3] transition-colors"
          >
            <Eye className="w-4 h-4" /> Detail
          </Link>
          {product.isArchived ? (
            canEdit ? (
              <ProductRestoreAction
                productId={product.id}
                productName={product.name}
                compact
              />
            ) : null
          ) : canManageActiveProduct ? (
            <>
              <Link
                href={`/products/${product.id}/edit`}
                aria-label={`Edit ${product.name}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#c5c0b1] rounded-[4px] text-[14px] font-semibold text-[#201515] hover:bg-[#eceae3] transition-colors"
              >
                <Edit2 className="w-4 h-4" /> Edit
              </Link>
              <ProductDeleteAction
                productId={product.id}
                productName={product.name}
                compact
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
