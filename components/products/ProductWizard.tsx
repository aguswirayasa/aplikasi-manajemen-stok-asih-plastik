"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type Category = { id: string; name: string };
type VariationValue = { id: string; value: string };
type VariationType = { id: string; name: string; values: VariationValue[] };

function cartesian<T>(options: Record<string, T[]>): Record<string, T>[] {
  const keys = Object.keys(options).filter(k => options[k].length > 0);
  if (keys.length === 0) return [];
  const result: Record<string, T>[] = [];
  const helper = (index: number, current: Record<string, T>) => {
    if (index === keys.length) {
      result.push({ ...current });
      return;
    }
    const key = keys[index];
    for (const val of options[key]) {
      current[key] = val;
      helper(index + 1, current);
    }
  };
  helper(0, {});
  return result;
}

export function ProductWizard({ categories, variationTypes }: { categories: Category[], variationTypes: VariationType[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");

  const [selectedVariations, setSelectedVariations] = useState<Record<string, string[]>>({});

  const [defaultPrice, setDefaultPrice] = useState("");
  
  const combinations = cartesian(selectedVariations);
  
  const canGoNext = () => {
    if (step === 1) return name.trim() !== "" && categoryId !== "";
    if (step === 2) return Object.keys(selectedVariations).some(k => selectedVariations[k].length > 0);
    return true;
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const activeVariationTypes = variationTypes
        .map((variationType) => variationType.id)
        .filter((typeId) => selectedVariations[typeId]?.length > 0);

      const activeVariations = Object.fromEntries(
        Object.entries(selectedVariations).filter(([, values]) => values.length > 0)
      );

      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, categoryId, description,
          variationTypeIds: activeVariationTypes,
          combinations: activeVariations,
          defaultPrice: parseInt(defaultPrice, 10) || 0
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Gagal menyimpan produk.");
      }

      toast.success("Produk berhasil dibuat.");
      router.push("/products");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan produk."
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleVariationType = (typeId: string) => {
    const next = { ...selectedVariations };
    if (next[typeId]) {
      delete next[typeId];
    } else {
      next[typeId] = [];
    }
    setSelectedVariations(next);
  };

  const toggleVariationValue = (typeId: string, valId: string) => {
    const next = { ...selectedVariations };
    if (!next[typeId]) next[typeId] = [];
    
    if (next[typeId].includes(valId)) {
      next[typeId] = next[typeId].filter(id => id !== valId);
    } else {
      next[typeId] = [...next[typeId], valId];
    }
    setSelectedVariations(next);
  };

  const valueMap = new Map<string, string>();
  variationTypes.forEach(t => t.values.forEach(v => valueMap.set(v.id, v.value)));

  return (
    <div className="bg-[#fffefb] border border-[#c5c0b1] rounded-[8px] overflow-hidden">
      <div className="flex border-b border-[#c5c0b1] bg-[#eceae3]/50">
        {[1, 2, 3].map((s) => (
          <div 
            key={s} 
            className={`flex-1 text-center py-3 font-medium text-[14px] uppercase tracking-[0.5px] border-b-[4px] ${
              step === s 
                ? 'border-[#ff4f00] text-[#201515] bg-[#fffefb]' 
                : step > s 
                  ? 'border-[#c5c0b1] text-[#939084] bg-[#fffefb]'
                  : 'border-transparent text-[#939084]'
            }`}
          >
            Langkah {s}
          </div>
        ))}
      </div>

      <div className="p-4 md:p-8">
        {step === 1 && (
          <div className="space-y-6 max-w-[600px] mx-auto">
            <div>
              <label className="block text-[16px] font-semibold text-[#201515] mb-2">Nama Produk</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="cth. Plastik HD"
                className="w-full border border-[#c5c0b1] rounded-[5px] px-3 py-2 bg-[#fffefb] text-[#201515] placeholder-[#939084] focus:border-[#ff4f00] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[16px] font-semibold text-[#201515] mb-2">Kategori</label>
              <select 
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full border border-[#c5c0b1] rounded-[5px] px-3 py-2 bg-[#fffefb] text-[#201515] focus:border-[#ff4f00] focus:outline-none"
              >
                <option value="">Pilih kategori...</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[16px] font-semibold text-[#201515] mb-2">Deskripsi</label>
              <textarea 
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Deskripsi produk (opsional)"
                rows={3}
                className="w-full border border-[#c5c0b1] rounded-[5px] px-3 py-2 bg-[#fffefb] text-[#201515] placeholder-[#939084] focus:border-[#ff4f00] focus:outline-none"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 max-w-[600px] mx-auto">
            <div>
              <h2 className="text-[24px] font-semibold text-[#201515] mb-1">Pilih Tipe Variasi</h2>
              <p className="text-[#939084] text-[16px] mb-4">Pilih variasi yang berlaku untuk produk ini.</p>
            </div>
            
            <div className="space-y-4">
              {variationTypes.map(type => (
                <div key={type.id} className="border border-[#c5c0b1] rounded-[5px] overflow-hidden">
                  <div 
                    className={`p-3 flex items-center gap-3 cursor-pointer ${selectedVariations[type.id] ? 'bg-[#eceae3]' : 'bg-[#fffefb]'}`}
                    onClick={() => toggleVariationType(type.id)}
                  >
                    <input 
                      type="checkbox" 
                      checked={!!selectedVariations[type.id]}
                      readOnly
                      className="w-5 h-5 accent-[#ff4f00]"
                    />
                    <span className="font-semibold text-[#201515]">{type.name}</span>
                  </div>
                  
                  {selectedVariations[type.id] && (
                    <div className="p-4 bg-[#fffefb] border-t border-[#c5c0b1]">
                      <div className="flex flex-wrap gap-2">
                        {type.values.map(val => {
                          const isSelected = selectedVariations[type.id]?.includes(val.id);
                          return (
                            <button
                              key={val.id}
                              onClick={() => toggleVariationValue(type.id, val.id)}
                              className={`px-4 py-1.5 rounded-[20px] text-[14px] font-medium border transition-colors ${
                                isSelected 
                                  ? 'bg-[#201515] text-[#fffefb] border-[#201515]' 
                                  : 'bg-[#fffefb] text-[#36342e] border-[#c5c0b1] hover:bg-[#eceae3]'
                              }`}
                            >
                              {val.value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
             <div>
              <h2 className="text-[24px] font-semibold text-[#201515] mb-1">Pratinjau Matriks SKU</h2>
              <p className="text-[#939084] text-[16px] mb-4">Atur harga default. Harga tiap SKU bisa diedit nanti.</p>
            </div>

            <div className="max-w-[400px] mb-6">
              <label className="block text-[16px] font-semibold text-[#201515] mb-2">Harga Default (Rp)</label>
              <input 
                type="number" 
                value={defaultPrice}
                onChange={e => setDefaultPrice(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full border border-[#c5c0b1] rounded-[5px] px-3 py-2 bg-[#fffefb] text-[#201515] focus:border-[#ff4f00] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {combinations.map((combo, idx) => (
                <div key={idx} className="border border-[#c5c0b1] rounded-[5px] p-4 bg-[#fffefb]">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {Object.values(combo).map(valId => (
                      <span key={valId as string} className="text-[12px] font-bold text-[#ff4f00] bg-[#ff4f00]/10 px-2 py-0.5 rounded-[3px] uppercase tracking-wide">
                        {valueMap.get(valId)}
                      </span>
                    ))}
                  </div>
                  <div className="text-[14px] text-[#939084] mt-2">
                    SKU akan dibuat otomatis
                  </div>
                </div>
              ))}
              {combinations.length === 0 && (
                <div className="col-span-full p-8 text-center text-[#939084] border border-dashed border-[#c5c0b1] rounded-[5px]">
                  Belum ada variasi dipilih. Satu SKU default akan dibuat.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-[#c5c0b1] bg-[#fffefb] p-4 md:px-8 flex justify-between items-center sticky bottom-0 md:static">
        <button 
          onClick={() => setStep(step - 1)}
          disabled={step === 1 || loading}
          className="px-4 py-2 border border-[#c5c0b1] text-[#201515] rounded-[4px] font-semibold disabled:opacity-50 flex items-center gap-2 hover:bg-[#eceae3] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        
        {step < 3 ? (
          <button 
            onClick={() => setStep(step + 1)}
            disabled={!canGoNext()}
            className="px-6 py-2 bg-[#ff4f00] text-[#fffefb] rounded-[4px] font-semibold disabled:opacity-50 flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            Lanjut <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button 
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-[#201515] text-[#fffefb] rounded-[4px] font-semibold disabled:opacity-50 flex items-center gap-2 hover:bg-[#36342e] transition-colors"
          >
            {loading ? "Menyimpan..." : "Simpan Produk"} <Check className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
