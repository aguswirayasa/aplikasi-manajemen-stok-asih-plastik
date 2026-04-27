import { ProductWizard } from "@/components/products/ProductWizard";
import prisma from "@/lib/prisma";
import { requirePageAdmin } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requirePageAdmin();

  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' }
  });
  
  const variationTypes = await prisma.variationType.findMany({
    include: { values: true },
    orderBy: { name: 'asc' }
  });

  return (
    <div className="min-h-screen bg-[#fffefb] text-[#201515] pb-24 md:pb-8 font-sans">
      <div className="max-w-[960px] mx-auto px-4 md:px-8 py-6 md:py-10">
        <header className="mb-8">
          <h1 className="text-[32px] md:text-[40px] font-medium leading-[0.9] tracking-tight mb-2">
            Produk Baru
          </h1>
          <p className="text-[#36342e] text-[16px] leading-[1.25]">
            Tambahkan produk baru beserta variasi dan matriks SKU.
          </p>
        </header>
        
        <ProductWizard categories={categories} variationTypes={variationTypes} />
      </div>
    </div>
  );
}
