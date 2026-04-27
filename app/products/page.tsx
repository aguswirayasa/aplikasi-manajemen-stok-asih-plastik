import Link from "next/link";
import prisma from "@/lib/prisma";
import { Plus, Edit2, AlertCircle } from "lucide-react";
import { ProductCard } from "@/components/products/ProductCard";
import { requirePageAuth } from "@/lib/page-auth";
import { getProductSummary } from "@/lib/product-summary";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await requirePageAuth();

  const products = await prisma.product.findMany({
    include: {
      category: true,
      variants: true,
    },
    orderBy: { name: 'asc' }
  });

  return (
    <div className="min-h-screen bg-[#fffefb] text-[#201515] pb-24 md:pb-8 font-sans">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 md:py-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-[32px] md:text-[40px] font-medium leading-[0.9] tracking-tight mb-2">
              Produk
            </h1>
            <p className="text-[#36342e] text-[16px] leading-[1.25]">
              Kelola katalog produk dan ringkasan stok.
            </p>
          </div>
          <Link href="/products/new" className="px-6 py-2.5 bg-[#ff4f00] text-[#fffefb] rounded-[4px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity w-full md:w-auto">
            <Plus className="w-5 h-5" /> Produk Baru
          </Link>
        </header>

        <div className="hidden md:block bg-[#fffefb] border border-[#c5c0b1] rounded-[8px] overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#eceae3]/50 border-b border-[#c5c0b1]">
                <th className="p-4 font-semibold text-[#201515]">Nama Produk</th>
                <th className="p-4 font-semibold text-[#201515]">Kategori</th>
                <th className="p-4 font-semibold text-[#201515]">Varian</th>
                <th className="p-4 font-semibold text-[#201515]">Total Stok</th>
                <th className="p-4 font-semibold text-[#201515]">Status</th>
                <th className="p-4 font-semibold text-[#201515] text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => {
                const { totalVariants, totalStock, hasLowStock } =
                  getProductSummary(product);

                return (
                  <tr key={product.id} className="border-b border-[#c5c0b1] last:border-0 hover:bg-[#eceae3]/20 transition-colors">
                    <td className="p-4 font-medium text-[#201515]">{product.name}</td>
                    <td className="p-4 text-[#36342e]">{product.category.name}</td>
                    <td className="p-4 text-[#36342e]">{totalVariants} SKUs</td>
                    <td className="p-4 text-[#36342e] font-semibold">{totalStock}</td>
                    <td className="p-4">
                      {hasLowStock ? (
                        <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#ff4f00] bg-[#ff4f00]/10 px-2.5 py-1 rounded-[20px]">
                          <AlertCircle className="w-4 h-4" /> Stok Rendah
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#939084]">
                          Stok Aman
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <Link href={`/products/${product.id}`} className="inline-flex items-center gap-2 px-3 py-1.5 border border-[#c5c0b1] rounded-[4px] text-[14px] font-semibold text-[#201515] hover:bg-[#eceae3] transition-colors">
                        <Edit2 className="w-4 h-4" /> Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#939084] italic">
                    Belum ada produk. Tambahkan produk pertama untuk mulai.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-4">
          {products.map(product => <ProductCard key={product.id} product={product} />)}
          {products.length === 0 && (
            <div className="p-8 text-center text-[#939084] italic border border-dashed border-[#c5c0b1] rounded-[8px]">
              Belum ada produk.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
