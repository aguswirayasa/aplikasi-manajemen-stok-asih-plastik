import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { Archive, ChevronLeft, ChevronRight, Edit2, Eye, Plus, Search } from "lucide-react";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductDeleteAction } from "@/components/products/ProductDeleteAction";
import { ProductRestoreAction } from "@/components/products/ProductRestoreAction";
import { ProductStockStatus } from "@/components/products/ProductStockStatus";
import { requirePageAuth } from "@/lib/page-auth";
import { getProductSummary } from "@/lib/product-summary";

export const dynamic = "force-dynamic";

const PRODUCTS_PAGE_SIZE = 10;

type ProductSearchParams = Record<string, string | string[] | undefined>;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<ProductSearchParams>;
}) {
  const user = await requirePageAuth();
  const canEditProducts = user.role === "ADMIN";
  const resolvedSearchParams = await searchParams;
  const searchQuery = readSearchParam(resolvedSearchParams, "q").trim();
  const requestedPage = parsePage(readSearchParam(resolvedSearchParams, "page"));
  const where = buildProductWhere(searchQuery);

  const totalItems = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / PRODUCTS_PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  const products = await prisma.product.findMany({
    where,
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
      },
    },
    orderBy: { name: "asc" },
    skip: (currentPage - 1) * PRODUCTS_PAGE_SIZE,
    take: PRODUCTS_PAGE_SIZE,
  });
  const pagination = {
    page: currentPage,
    totalItems,
    totalPages,
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
  };
  const resultLabel = searchQuery
    ? `Menampilkan ${products.length} dari ${totalItems} produk untuk "${searchQuery}"`
    : `Menampilkan ${products.length} dari ${totalItems} produk`;
  const emptyTitle = searchQuery ? "Produk tidak ditemukan." : "Belum ada produk.";
  const emptyDescription = searchQuery
    ? "Ubah kata kunci untuk mencari nama produk, kategori, SKU, atau variasi lain."
    : "Tambahkan produk pertama untuk mulai.";

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
          {canEditProducts && (
            <Link href="/products/new" className="px-6 py-2.5 bg-[#ff4f00] text-[#fffefb] rounded-[4px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity w-full md:w-auto">
              <Plus className="w-5 h-5" /> Produk Baru
            </Link>
          )}
        </header>

        <section className="mb-5 rounded-[8px] border border-[#c5c0b1] bg-[#fffefb] p-4">
          <form className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <label className="space-y-1.5">
              <span className="text-[12px] font-bold text-[#36342e]">
                Cari produk
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#939084]" />
                <input
                  type="search"
                  name="q"
                  defaultValue={searchQuery}
                  placeholder="Cari nama produk, kategori, SKU, atau variasi"
                  className="min-h-10 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] py-2 pl-9 pr-3 text-[14px] font-semibold text-[#201515] outline-none focus:border-[#ff4f00] focus:ring-2 focus:ring-[#ff4f00]/20"
                />
              </div>
            </label>
            <button
              type="submit"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-[#ff4f00] bg-[#ff4f00] px-4 text-[13px] font-bold text-[#fffefb] hover:bg-[#e64600]"
            >
              <Search className="h-4 w-4" />
              Cari
            </button>
            {searchQuery ? (
              <Link
                href="/products"
                className="inline-flex min-h-10 items-center justify-center rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-4 text-[13px] font-bold text-[#201515] hover:bg-[#eceae3]"
              >
                Reset
              </Link>
            ) : null}
          </form>
          <p className="mt-3 text-[13px] font-semibold text-[#36342e]">
            {resultLabel}
          </p>
        </section>

        <div className="hidden md:block bg-[#fffefb] border border-[#c5c0b1] rounded-[8px] overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#eceae3]/50 border-b border-[#c5c0b1]">
                <th className="p-4 font-semibold text-[#201515]">Nama Produk</th>
                <th className="p-4 font-semibold text-[#201515]">Kategori</th>
                <th className="p-4 font-semibold text-[#201515]">Varian</th>
                <th className="p-4 font-semibold text-[#201515]">Total Stok (pcs)</th>
                <th className="p-4 font-semibold text-[#201515]">Status</th>
                <th className="p-4 font-semibold text-[#201515] text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => {
                const { totalVariants, totalStock, stockStatus } =
                  getProductSummary(product);
                const canManageActiveProduct =
                  canEditProducts && !product.isArchived;

                return (
                  <tr key={product.id} className="border-b border-[#c5c0b1] last:border-0 hover:bg-[#eceae3]/20 transition-colors">
                    <td className="p-4 font-medium text-[#201515]">{product.name}</td>
                    <td className="p-4 text-[#36342e]">{product.category.name}</td>
                    <td className="p-4 text-[#36342e]">{totalVariants} SKUs</td>
                    <td className="p-4 text-[#36342e] font-semibold">{totalStock}</td>
                    <td className="p-4">
                      {product.isArchived ? (
                        <span className="inline-flex items-center gap-2 rounded-[20px] bg-[#eceae3] px-3 py-1 text-[13px] font-semibold text-[#6f6a5f]">
                          <Archive className="h-4 w-4" />
                          Diarsipkan
                        </span>
                      ) : (
                        <ProductStockStatus status={stockStatus} />
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <Link
                          href={`/products/${product.id}`}
                          aria-label={`Lihat detail ${product.name}`}
                          className="inline-flex items-center gap-2 px-3 py-1.5 border border-[#c5c0b1] rounded-[4px] text-[14px] font-semibold text-[#201515] hover:bg-[#eceae3] transition-colors"
                        >
                          <Eye className="w-4 h-4" /> Detail
                        </Link>
                        {product.isArchived ? (
                          canEditProducts ? (
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
                              className="inline-flex items-center gap-2 px-3 py-1.5 border border-[#c5c0b1] rounded-[4px] text-[14px] font-semibold text-[#201515] hover:bg-[#eceae3] transition-colors"
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
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#939084] italic">
                    <span className="font-semibold text-[#36342e]">
                      {emptyTitle}
                    </span>{" "}
                    {emptyDescription}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-4">
          {products.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              canEdit={canEditProducts}
            />
          ))}
          {products.length === 0 && (
            <div className="p-8 text-center text-[#939084] italic border border-dashed border-[#c5c0b1] rounded-[8px]">
              <span className="font-semibold text-[#36342e]">{emptyTitle}</span>{" "}
              {emptyDescription}
            </div>
          )}
        </div>

        <ProductPagination pagination={pagination} searchQuery={searchQuery} />
      </div>
    </div>
  );
}

function ProductPagination({
  pagination,
  searchQuery,
}: {
  pagination: {
    page: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  searchQuery: string;
}) {
  if (pagination.totalItems === 0) {
    return null;
  }

  const previousHref = buildProductsHref({
    q: searchQuery,
    page: pagination.page - 1,
  });
  const nextHref = buildProductsHref({
    q: searchQuery,
    page: pagination.page + 1,
  });

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-[8px] border border-[#c5c0b1] bg-[#fffefb] p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-center text-[13px] font-semibold text-[#36342e] sm:text-left">
        Halaman {pagination.page} dari {pagination.totalPages}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        {pagination.hasPreviousPage ? (
          <Link
            href={previousHref}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-4 text-[13px] font-bold text-[#201515] hover:bg-[#eceae3]"
          >
            <ChevronLeft className="h-4 w-4" />
            Sebelumnya
          </Link>
        ) : (
          <span className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-[#eceae3] bg-[#eceae3]/30 px-4 text-[13px] font-bold text-[#939084]">
            <ChevronLeft className="h-4 w-4" />
            Sebelumnya
          </span>
        )}
        {pagination.hasNextPage ? (
          <Link
            href={nextHref}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-4 text-[13px] font-bold text-[#201515] hover:bg-[#eceae3]"
          >
            Berikutnya
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-[#eceae3] bg-[#eceae3]/30 px-4 text-[13px] font-bold text-[#939084]">
            Berikutnya
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}

function buildProductWhere(searchQuery: string): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};

  if (!searchQuery) {
    return where;
  }

  return {
    ...where,
    OR: [
      { name: { contains: searchQuery } },
      { category: { name: { contains: searchQuery } } },
      { variants: { some: { sku: { contains: searchQuery } } } },
      {
        variants: {
          some: {
            values: {
              some: {
                variationValue: {
                  value: { contains: searchQuery },
                },
              },
            },
          },
        },
      },
    ],
  };
}

function readSearchParam(params: ProductSearchParams, key: string) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

function parsePage(value: string) {
  const parsed = Number(value);

  if (!value || !Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function buildProductsHref({ q, page }: { q: string; page: number }) {
  const params = new URLSearchParams();

  if (q) {
    params.set("q", q);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();

  return query ? `/products?${query}` : "/products";
}
