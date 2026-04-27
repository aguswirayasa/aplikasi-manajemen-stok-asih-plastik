export type ProductSummaryInput = {
  variants: {
    stock: number;
    minStock: number;
  }[];
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

  return { totalVariants, totalStock, hasLowStock };
}
