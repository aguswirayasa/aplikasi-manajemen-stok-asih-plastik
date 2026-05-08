import { notFound } from "next/navigation";
import {
  ProductDetailView,
  type ProductDetailMovement,
  type ProductDetailViewProduct,
} from "@/components/products/ProductDetailView";
import { requirePageAuth } from "@/lib/page-auth";
import { getProductSummary } from "@/lib/product-summary";
import prisma from "@/lib/prisma";
import {
  mergeStockTransactions,
  stockTransactionInclude,
} from "@/lib/stock-transactions";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageAuth();
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      variants: {
        include: {
          values: {
            include: {
              variationValue: {
                include: {
                  variationType: true,
                },
              },
            },
          },
        },
        orderBy: { sku: "asc" },
      },
    },
  });

  if (!product) {
    return notFound();
  }

  const [stockIns, stockOuts] = await Promise.all([
    prisma.stockIn.findMany({
      where: { variant: { productId: id } },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: stockTransactionInclude,
    }),
    prisma.stockOut.findMany({
      where: { variant: { productId: id } },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: stockTransactionInclude,
    }),
  ]);
  const recentMovements = mergeStockTransactions(stockIns, stockOuts, 8);
  const { totalVariants, totalStock, stockStatus } = getProductSummary(product);

  return (
    <ProductDetailView
      product={toProductDetailViewProduct(product)}
      summary={{ totalVariants, totalStock, stockStatus }}
      recentMovements={recentMovements.map(toProductDetailMovement)}
      canEdit={user.role === "ADMIN" && !product.isArchived}
      canDelete={user.role === "ADMIN" && !product.isArchived}
    />
  );
}

function toProductDetailViewProduct(product: {
  id: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  category: { name: string };
  variants: {
    id: string;
    sku: string;
    price: { toString(): string };
    stock: number;
    minStock: number;
    isActive: boolean;
    values: {
      variationValue: {
        value: string;
        variationType?: { name: string } | null;
      };
    }[];
  }[];
}): ProductDetailViewProduct {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    isArchived: product.isArchived,
    categoryName: product.category.name,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      price: Number(variant.price.toString()),
      stock: variant.stock,
      minStock: variant.minStock,
      isActive: variant.isActive,
      values: variant.values.map((value) => ({
        value: value.variationValue.value,
        typeName: value.variationValue.variationType?.name,
      })),
    })),
  };
}

function toProductDetailMovement(
  movement: ReturnType<typeof mergeStockTransactions>[number],
): ProductDetailMovement {
  return {
    id: movement.id,
    type: movement.type,
    sku: movement.variant.sku,
    quantity: movement.quantity,
    note: movement.note,
    userName: movement.user.name || movement.user.username,
    createdAt: movement.createdAt,
  };
}
