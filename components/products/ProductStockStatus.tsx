import { AlertCircle } from "lucide-react";
import type { ProductStockStatus as ProductStockStatusData } from "@/lib/product-summary";

type ProductStockStatusProps = {
  status: ProductStockStatusData;
  detail?: "compact" | "comfortable";
};

export function ProductStockStatus({
  status,
  detail = "compact",
}: ProductStockStatusProps) {
  return (
    <div className="min-w-0">
      {status.isWarning ? (
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-[20px] bg-[#ff4f00]/10 px-2.5 py-1 text-[14px] font-semibold text-[#ff4f00]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="truncate">{status.label}</span>
        </span>
      ) : (
        <span className="inline-flex max-w-full items-center gap-1.5 text-[14px] font-medium text-[#939084]">
          <span className="truncate">{status.label}</span>
        </span>
      )}

      {status.detailText && (
        <p
          title={status.detailText}
          className={
            detail === "comfortable"
              ? "mt-1 text-[13px] leading-[1.25] text-[#939084] break-words"
              : "mt-1 max-w-[210px] truncate text-[12px] leading-[1.2] text-[#939084]"
          }
        >
          {status.detailText}
        </p>
      )}
    </div>
  );
}
