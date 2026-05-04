import { notFound } from "next/navigation";
import { ProductEditForm } from "@/components/products/ProductEditForm";
import { requirePageAdmin } from "@/lib/page-auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAdmin();
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: {
          include: {
            values: {
              include: {
                variationValue: true,
              },
            },
          },
          orderBy: { sku: "asc" },
        },
      },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  if (!product) {
    return notFound();
  }

  const editProduct = {
    id: product.id,
    name: product.name,
    categoryId: product.categoryId,
    description: product.description ?? "",
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      price: variant.price.toString(),
      stock: variant.stock,
      minStock: variant.minStock,
      isActive: variant.isActive,
      values: variant.values.map((value) => ({
        variationValue: {
          value: value.variationValue.value,
        },
      })),
    })),
  };

  return (
    <div className="min-h-screen bg-[#fffefb] text-[#201515] pb-24 md:pb-8 font-sans">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 md:py-10">
        <header className="mb-8">
          <h1 className="text-[32px] md:text-[40px] font-medium leading-[0.95] tracking-tight mb-2 break-words">
            Edit {product.name}
          </h1>
          <p className="text-[#36342e] text-[16px] leading-[1.25]">
            Simpan perubahan produk, SKU, minimum stok, dan penyesuaian stok
            dalam satu aksi.
          </p>
        </header>

        <ProductEditForm product={editProduct} categories={categories} />
      </div>
    </div>
  );
}
