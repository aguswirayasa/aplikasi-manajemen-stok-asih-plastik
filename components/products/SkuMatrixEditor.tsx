"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

type SkuVariant = {
  id: string;
  sku: string;
  price: string;
  stock: number;
  minStock: number;
  isActive: boolean;
  values: {
    variationValue: {
      value: string;
    };
  }[];
};

type SkuMatrixProduct = {
  id: string;
  variants: SkuVariant[];
};

type EditableVariantField = "price" | "minStock" | "isActive";

type EditableVariantValue = string | number | boolean;

export function SkuMatrixEditor({ product }: { product: SkuMatrixProduct }) {
  const [variants, setVariants] = useState<SkuVariant[]>(product.variants);
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpdate = async (
    variantId: string,
    field: EditableVariantField,
    value: EditableVariantValue
  ) => {
    const previous = variants;

    setVariants((current) =>
      current.map((variant) =>
        variant.id === variantId ? { ...variant, [field]: value } : variant
      )
    );

    setLoading(variantId);
    try {
      const res = await fetch(`/api/products/${product.id}/variants/${variantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Gagal menyimpan SKU.");
      }

      toast.success("SKU berhasil diperbarui.");
    } catch (error) {
      setVariants(previous);
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan SKU."
      );
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-[#fffefb] border border-[#c5c0b1] rounded-[8px] overflow-hidden">
      <div className="p-4 bg-[#eceae3]/50 border-b border-[#c5c0b1] flex justify-between items-center">
        <h2 className="text-[18px] font-semibold text-[#201515]">Matriks SKU</h2>
        <span className="text-[14px] text-[#939084] font-medium">{variants.length} Varian</span>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#c5c0b1]">
              <th className="p-4 font-semibold text-[#201515]">SKU / Variasi</th>
              <th className="p-4 font-semibold text-[#201515]">Harga (Rp)</th>
              <th className="p-4 font-semibold text-[#201515]">Stok</th>
              <th className="p-4 font-semibold text-[#201515]">Min. Stok</th>
              <th className="p-4 font-semibold text-[#201515] text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant) => {
              const variationTags = variant.values
                .map((value) => value.variationValue.value)
                .join(" - ");
              const isLowStock = variant.stock <= variant.minStock;

              return (
                <tr key={variant.id} className={`border-b border-[#c5c0b1] last:border-0 hover:bg-[#eceae3]/20 ${!variant.isActive ? "opacity-50 bg-[#eceae3]/50" : ""}`}>
                  <td className="p-4">
                    <div className="font-bold text-[#201515]">{variant.sku}</div>
                    <div className="text-[13px] text-[#939084] mt-0.5">{variationTags}</div>
                  </td>
                  <td className="p-4">
                    <input
                      type="number"
                      value={variant.price}
                      onChange={(event) =>
                        handleUpdate(variant.id, "price", parseInt(event.target.value, 10) || 0)
                      }
                      className="w-[120px] border border-[#c5c0b1] rounded-[4px] px-2 py-1.5 text-[14px] bg-[#fffefb] focus:border-[#ff4f00] focus:outline-none"
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={variant.stock}
                        readOnly
                        title="Stok hanya bisa diubah lewat transaksi stok masuk atau stok keluar."
                        className={`w-[80px] border ${isLowStock ? "border-[#ff4f00] text-[#ff4f00] font-bold bg-[#ff4f00]/5" : "border-[#c5c0b1]"} rounded-[4px] px-2 py-1.5 text-[14px] focus:outline-none bg-[#eceae3]/50 cursor-not-allowed`}
                      />
                      {isLowStock && <AlertCircle className="w-4 h-4 text-[#ff4f00]" />}
                    </div>
                  </td>
                  <td className="p-4">
                    <input
                      type="number"
                      value={variant.minStock}
                      onChange={(event) =>
                        handleUpdate(variant.id, "minStock", parseInt(event.target.value, 10) || 0)
                      }
                      className="w-[80px] border border-[#c5c0b1] rounded-[4px] px-2 py-1.5 text-[14px] bg-[#fffefb] focus:border-[#ff4f00] focus:outline-none"
                    />
                  </td>
                  <td className="p-4 flex justify-center">
                    <label className="flex items-center cursor-pointer mt-1">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={variant.isActive}
                          onChange={(event) =>
                            handleUpdate(variant.id, "isActive", event.target.checked)
                          }
                        />
                        <div className={`block w-10 h-6 rounded-[20px] transition-colors ${variant.isActive ? "bg-[#ff4f00]" : "bg-[#c5c0b1]"}`}></div>
                        <div className={`absolute left-1 top-1 bg-[#fffefb] w-4 h-4 rounded-full transition-transform ${variant.isActive ? "transform translate-x-4" : ""}`}></div>
                      </div>
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        {variants.map((variant) => {
          const variationTags = variant.values
            .map((value) => value.variationValue.value)
            .join(" - ");
          const isLowStock = variant.stock <= variant.minStock;

          return (
            <div key={variant.id} className={`p-4 border-b border-[#c5c0b1] last:border-0 ${!variant.isActive ? "opacity-50 bg-[#eceae3]/50" : ""}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-bold text-[#201515] text-[16px]">{variant.sku}</div>
                  <div className="text-[13px] text-[#939084]">{variationTags}</div>
                </div>
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={variant.isActive}
                      onChange={(event) =>
                        handleUpdate(variant.id, "isActive", event.target.checked)
                      }
                    />
                    <div className={`block w-10 h-6 rounded-[20px] transition-colors ${variant.isActive ? "bg-[#ff4f00]" : "bg-[#c5c0b1]"}`}></div>
                    <div className={`absolute left-1 top-1 bg-[#fffefb] w-4 h-4 rounded-full transition-transform ${variant.isActive ? "transform translate-x-4" : ""}`}></div>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[#939084] uppercase tracking-wider mb-1">Harga</label>
                  <input
                    type="number"
                    value={variant.price}
                    onChange={(event) =>
                      handleUpdate(variant.id, "price", parseInt(event.target.value, 10) || 0)
                    }
                    className="w-full border border-[#c5c0b1] rounded-[4px] px-2 py-1.5 text-[14px] bg-[#fffefb] focus:border-[#ff4f00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#939084] uppercase tracking-wider mb-1">Stok</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={variant.stock}
                      readOnly
                      title="Stok hanya bisa diubah lewat transaksi stok masuk atau stok keluar."
                      className={`w-full border ${isLowStock ? "border-[#ff4f00] text-[#ff4f00] font-bold bg-[#ff4f00]/5" : "border-[#c5c0b1]"} rounded-[4px] px-2 py-1.5 text-[14px] bg-[#eceae3]/50 focus:outline-none cursor-not-allowed`}
                    />
                    {isLowStock && <AlertCircle className="w-5 h-5 text-[#ff4f00] shrink-0" />}
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#939084] uppercase tracking-wider mb-1">Min. Stok</label>
                  <input
                    type="number"
                    value={variant.minStock}
                    onChange={(event) =>
                      handleUpdate(variant.id, "minStock", parseInt(event.target.value, 10) || 0)
                    }
                    className="w-full border border-[#c5c0b1] rounded-[4px] px-2 py-1.5 text-[14px] bg-[#fffefb] focus:border-[#ff4f00] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
