import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SkuMatrixEditor } from "@/components/products/SkuMatrixEditor";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePageAdmin } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAdmin();

  const { id } = await params;
  
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      variants: {
        include: {
          values: {
            include: {
              variationValue: true
            }
          }
        },
        orderBy: { sku: 'asc' }
      }
    }
  });

  if (!product) return notFound();

  const editorProduct = {
    id: product.id,
    name: product.name,
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
        <Link href="/products" className="inline-flex items-center gap-2 text-[#939084] hover:text-[#201515] transition-colors font-medium mb-6">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Produk
        </Link>
        
        <header className="mb-8">
          <h1 className="text-[32px] md:text-[40px] font-medium leading-[0.9] tracking-tight mb-2">
            {product.name}
          </h1>
          <p className="text-[#36342e] text-[16px] leading-[1.25]">
            Kelola varian SKU, harga, batas stok, dan status aktif.
          </p>
        </header>

        <SkuMatrixEditor product={editorProduct} />
      </div>
    </div>
  );
}
