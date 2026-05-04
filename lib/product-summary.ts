export type ProductSummaryInput = {
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

export type ProductStockStatus = {
  label: string;
  detailText?: string;
  isWarning: boolean;
};

export function getProductSummary(product: ProductSummaryInput) {
  const totalVariants = product.variants.length;
  const totalStock = product.variants.reduce(
    (total, variant) => total + variant.stock,
    0
  );
  const hasLowStock = product.variants.some(
    (variant) => variant.stock <= variant.minStock
  );
  const stockStatus = getProductStockStatus(product.variants, hasLowStock);

  return { totalVariants, totalStock, hasLowStock, stockStatus };
}

function getProductStockStatus(
  variants: ProductSummaryInput["variants"],
  hasLowStock: boolean
): ProductStockStatus {
  const hasVariationValues = variants.some(
    (variant) => (variant.values?.length ?? 0) > 0
  );

  if (!hasVariationValues) {
    return {
      label: hasLowStock ? "Stok Rendah" : "Stok Aman",
      isWarning: hasLowStock,
    };
  }

  const emptyVariants = variants.filter((variant) => variant.stock <= 0);
  const lowVariants = variants.filter(
    (variant) => variant.stock > 0 && variant.stock <= variant.minStock
  );
  const problematicVariants = [...emptyVariants, ...lowVariants];

  if (problematicVariants.length === 0) {
    return {
      label: "Stok aman",
      isWarning: false,
    };
  }

  return {
    label: formatVariantStatusLabel(emptyVariants.length, lowVariants.length),
    detailText: formatLowestVariantDetail(problematicVariants),
    isWarning: true,
  };
}

function formatVariantStatusLabel(emptyCount: number, lowCount: number) {
  if (emptyCount > 0 && lowCount > 0) {
    return `${emptyCount} habis, ${lowCount} rendah`;
  }

  if (emptyCount > 0) {
    return `${emptyCount} varian habis`;
  }

  return `${lowCount} varian rendah`;
}

function formatLowestVariantDetail(
  variants: ProductSummaryInput["variants"]
) {
  const lowestVariant = [...variants].sort((first, second) => {
    const firstSeverity = first.stock <= 0 ? 0 : 1;
    const secondSeverity = second.stock <= 0 ? 0 : 1;

    if (firstSeverity !== secondSeverity) {
      return firstSeverity - secondSeverity;
    }

    const firstGap = first.stock - first.minStock;
    const secondGap = second.stock - second.minStock;

    if (firstGap !== secondGap) {
      return firstGap - secondGap;
    }

    return first.stock - second.stock;
  })[0];

  if (!lowestVariant) {
    return undefined;
  }

  return `Terendah: ${formatVariantName(lowestVariant)}, ${lowestVariant.stock} / min ${lowestVariant.minStock}`;
}

function formatVariantName(variant: ProductSummaryInput["variants"][number]) {
  const variationName = variant.values
    ?.map((value) => value.variationValue.value)
    .filter(Boolean)
    .join(" / ");

  return variationName || variant.sku || "SKU";
}
