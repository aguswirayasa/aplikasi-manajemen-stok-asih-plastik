"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  CheckSquare,
  ChevronRight,
  Check,
  PencilLine,
  SlidersHorizontal,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { CategoryQuickAdd } from "@/components/categories/CategoryQuickAdd";
import {
  getNextStep,
  getPrevStep,
  STEPS_DENGAN_VARIASI,
  STEPS_TANPA_VARIASI,
  VariationTypeFallback,
  VariationTypeQuickAdd,
  VariationValueQuickAdd,
  WizardStepIndicator,
  type VariationMode,
  type VariationType,
  type VariationValue,
} from "@/components/products/ProductWizardControls";
import type { Category } from "@/types/categories";

type GeneratedCombination = {
  key: string;
  valueIds: string[];
};

type VariantDraft = {
  price: string;
  stock: string;
  minStock: string;
};

type ReviewSku = {
  combination: GeneratedCombination;
  draft: VariantDraft;
  isAllZero: boolean;
  hasStockWithoutPrice: boolean;
};

type ReviewSummary = {
  skuList: ReviewSku[];
  allSkuValuesAreZero: boolean;
  allZeroCount: number;
  stockWithoutPriceCount: number;
};

const EMPTY_VARIANT_DRAFT: VariantDraft = {
  price: "0",
  stock: "0",
  minStock: "0",
};


const EMPTY_BULK_VARIANT_DRAFT: VariantDraft = {
  price: "",
  stock: "",
  minStock: "",
};


export function ProductWizard({
  categories,
  variationTypes,
}: {
  categories: Category[];
  variationTypes: VariationType[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [categoryOptions, setCategoryOptions] = useState(categories);

  // Mode variasi: "dengan" = produk dengan variasi, "tanpa" = produk tanpa variasi
  const [variationMode, setVariationMode] = useState<VariationMode>("dengan");
  const [variationTypeOptions, setVariationTypeOptions] =
    useState<VariationType[]>(variationTypes);
  const [typeQuickAddOpen, setTypeQuickAddOpen] = useState(false);

  const [selectedVariations, setSelectedVariations] = useState<
    Record<string, string[]>
  >({});
  const [selectedCombinationKeys, setSelectedCombinationKeys] = useState<
    string[]
  >([]);
  const [variantDrafts, setVariantDrafts] = useState<
    Record<string, VariantDraft>
  >({});
  const [singleVariantDraft, setSingleVariantDraft] =
    useState<VariantDraft>(EMPTY_VARIANT_DRAFT);
  const [bulkEditorOpen, setBulkEditorOpen] = useState(false);
  const [bulkFilters, setBulkFilters] = useState<Record<string, string>>({});
  const [bulkDraft, setBulkDraft] = useState<VariantDraft>(
    EMPTY_BULK_VARIANT_DRAFT,
  );

  // valueMap dibangun dari variationTypeOptions agar mencakup tipe/nilai yang baru ditambahkan
  const valueMap = useMemo(() => {
    const map = new Map<string, string>();
    variationTypeOptions.forEach((type) =>
      type.values.forEach((value) => map.set(value.id, value.value)),
    );
    return map;
  }, [variationTypeOptions]);

  // combinations bergantung pada variationTypeOptions agar kombinasi selalu sinkron dengan opsi terkini
  const combinations = useMemo(
    () => buildCombinations(variationTypeOptions, selectedVariations),
    [variationTypeOptions, selectedVariations],
  );
  const combinationKeySet = useMemo(
    () => new Set(combinations.map((combination) => combination.key)),
    [combinations],
  );
  const selectedCombinations = useMemo(
    () =>
      combinations.filter((combination) =>
        selectedCombinationKeys.includes(combination.key),
      ),
    [combinations, selectedCombinationKeys],
  );
  // activeVariationTypes bergantung pada variationTypeOptions agar mencakup tipe yang baru ditambahkan
  const activeVariationTypes = useMemo(
    () =>
      variationTypeOptions.filter(
        (variationType) =>
          (selectedVariations[variationType.id]?.length ?? 0) > 0,
      ),
    [selectedVariations, variationTypeOptions],
  );
  const matchedBulkCombinations = useMemo(
    () =>
      getMatchedBulkCombinations(
        selectedCombinations,
        activeVariationTypes,
        bulkFilters,
      ),
    [activeVariationTypes, bulkFilters, selectedCombinations],
  );
  const reviewSummary = useMemo(
    () => buildReviewSummary(selectedCombinations, variantDrafts),
    [selectedCombinations, variantDrafts],
  );
  const selectedCategoryName =
    categoryOptions.find((category) => category.id === categoryId)?.name ?? "-";
  const allCombinationsSelected =
    combinations.length > 0 &&
    selectedCombinations.length === combinations.length;

  const canGoNext = () => {
    if (step === 1) {
      return name.trim().length > 0 && categoryId.length > 0;
    }

    if (step === 2) {
      // Mode tanpa variasi: selalu bisa lanjut dari step 2
      if (variationMode === "tanpa") return true;
      return getActiveVariationTypeIds().length > 0 && combinations.length > 0;
    }

    if (step === 3) {
      return selectedCombinations.length > 0;
    }

    return true;
  };

  const handleSave = async () => {
    // Mode Dengan Variasi: validasi draft setiap kombinasi SKU sebelum menyimpan
    if (variationMode === "dengan") {
      const validationMessage = validateVariantDrafts(
        selectedCombinations,
        variantDrafts,
      );

      if (validationMessage) {
        toast.error(validationMessage);
        return;
      }
    }

    setLoading(true);
    try {
      // Bangun payload berbeda berdasarkan mode variasi
      const body =
        variationMode === "tanpa"
          ? {
              // Mode Tanpa Variasi: satu varian tunggal tanpa dimensi variasi
              name,
              categoryId,
              description,
              variants: [
                {
                  valueIds: [],
                  price: Number(singleVariantDraft.price),
                  stock: Number.parseInt(singleVariantDraft.stock, 10),
                  minStock: Number.parseInt(singleVariantDraft.minStock, 10),
                },
              ],
            }
          : {
              // Mode Dengan Variasi: payload tidak berubah dari implementasi sebelumnya
              name,
              categoryId,
              description,
              variationTypeIds: getActiveVariationTypeIds(),
              variants: selectedCombinations.map((combination) => {
                const draft = getVariantDraft(variantDrafts, combination.key);

                return {
                  valueIds: combination.valueIds,
                  price: Number(draft.price),
                  stock: Number.parseInt(draft.stock, 10),
                  minStock: Number.parseInt(draft.minStock, 10),
                };
              }),
            };

      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
        error instanceof Error ? error.message : "Gagal menyimpan produk.",
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleVariationType = (typeId: string) => {
    // Memilih tipe variasi apapun secara otomatis beralih ke mode "dengan"
    if (variationMode === "tanpa") {
      setVariationMode("dengan");
    }
    setSelectedVariations((current) => {
      const next = { ...current };

      if (next[typeId]) {
        delete next[typeId];
      } else {
        next[typeId] = [];
      }

      return next;
    });
    setSelectedCombinationKeys((current) =>
      current.filter((key) => combinationKeySet.has(key)),
    );
  };

  const toggleVariationValue = (typeId: string, valId: string) => {
    setSelectedVariations((current) => {
      const next = { ...current };
      const currentValues = next[typeId] ?? [];

      next[typeId] = currentValues.includes(valId)
        ? currentValues.filter((id) => id !== valId)
        : [...currentValues, valId];

      return next;
    });
    setSelectedCombinationKeys((current) =>
      current.filter((key) => combinationKeySet.has(key)),
    );
  };

  const toggleCombination = (combinationKey: string) => {
    setSelectedCombinationKeys((current) =>
      current.includes(combinationKey)
        ? current.filter((key) => key !== combinationKey)
        : [...current, combinationKey],
    );
  };

  const selectAllCombinations = () => {
    setSelectedCombinationKeys(
      combinations.map((combination) => combination.key),
    );
  };

  const clearCombinationSelection = () => {
    setSelectedCombinationKeys([]);
  };

  const handleCategoryCreated = (category: Category) => {
    setCategoryOptions((current) =>
      [...current, category].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setCategoryId(category.id);
  };

  // Menambah tipe variasi baru ke daftar opsi dan auto-check tipe tersebut
  const handleVariationTypeCreated = (newType: VariationType) => {
    // Normalisasi values ke array kosong jika API tidak menyertakannya (tipe baru belum punya nilai)
    const normalized: VariationType = {
      ...newType,
      values: newType.values ?? [],
    };

    setVariationMode("dengan");
    // Tambah ke daftar opsi, diurutkan alfabetis berdasarkan nama
    setVariationTypeOptions((current) =>
      [...current, normalized].sort((a, b) => a.name.localeCompare(b.name)),
    );
    // Auto-check tipe baru agar langsung aktif di Step 2
    setSelectedVariations((current) => ({
      ...current,
      [newType.id]: [],
    }));
  };

  // Menambah nilai variasi baru ke tipe yang sesuai dan auto-check nilai tersebut
  const handleVariationValueCreated = (
    typeId: string,
    newValue: VariationValue,
  ) => {
    setVariationMode("dengan");
    // Tambah nilai ke tipe yang sesuai dalam variationTypeOptions, diurutkan alfabetis
    setVariationTypeOptions((current) =>
      current.map((type) =>
        type.id === typeId
          ? {
              ...type,
              values: [...type.values, newValue].sort((a, b) =>
                a.value.localeCompare(b.value),
              ),
            }
          : type,
      ),
    );
    // Auto-check nilai baru agar langsung terpilih di Step 2
    setSelectedVariations((current) => ({
      ...current,
      [typeId]: [...(current[typeId] ?? []), newValue.id],
    }));
  };

  // Mengganti mode variasi dan mereset state variasi yang relevan
  const handleVariationModeChange = (mode: VariationMode) => {
    setVariationMode(mode);
    if (mode === "dengan") {
      // Reset state variasi agar user mulai dari awal saat kembali ke mode dengan variasi
      setSelectedVariations({});
      setSelectedCombinationKeys([]);
      setVariantDrafts({});
    } else {
      // Hapus semua pilihan tipe variasi saat beralih ke mode tanpa variasi
      setSelectedVariations({});
      setSelectedCombinationKeys([]);
    }
  };

  const updateVariantDraft = (
    combinationKey: string,
    field: keyof VariantDraft,
    value: string,
  ) => {
    setVariantDrafts((current) => ({
      ...current,
      [combinationKey]: {
        ...getVariantDraft(current, combinationKey),
        [field]: value,
      },
    }));
  };

  const normalizeVariantNumber = (
    combinationKey: string,
    field: keyof VariantDraft,
  ) => {
    setVariantDrafts((current) => {
      const draft = getVariantDraft(current, combinationKey);
      const value = draft[field].trim();

      if (value.length === 0) {
        return current;
      }

      const parsed =
        field === "price" ? Number(value) : Number.parseInt(value, 10);

      if (!Number.isFinite(parsed) || parsed < 0) {
        return current;
      }

      return {
        ...current,
        [combinationKey]: {
          ...draft,
          [field]: parsed.toString(),
        },
      };
    });
  };

  // Memperbarui satu field pada singleVariantDraft untuk mode Tanpa Variasi
  const updateSingleVariantDraft = (field: keyof VariantDraft, value: string) => {
    setSingleVariantDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  // Normalisasi angka pada singleVariantDraft saat field kehilangan fokus
  const normalizeSingleVariantNumber = (field: keyof VariantDraft) => {
    setSingleVariantDraft((current) => {
      const value = current[field].trim();

      if (value.length === 0) {
        return current;
      }

      const parsed =
        field === "price" ? Number(value) : Number.parseInt(value, 10);

      if (!Number.isFinite(parsed) || parsed < 0) {
        return current;
      }

      return {
        ...current,
        [field]: parsed.toString(),
      };
    });
  };

  const updateBulkDraft = (field: keyof VariantDraft, value: string) => {
    setBulkDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const normalizeBulkDraftNumber = (field: keyof VariantDraft) => {
    setBulkDraft((current) => {
      const value = current[field].trim();

      if (value.length === 0) {
        return current;
      }

      const parsed =
        field === "price" ? Number(value) : Number.parseInt(value, 10);

      if (!Number.isFinite(parsed) || parsed < 0) {
        return current;
      }

      return {
        ...current,
        [field]: parsed.toString(),
      };
    });
  };

  const updateBulkFilter = (typeId: string, valueId: string) => {
    setBulkFilters((current) => ({
      ...current,
      [typeId]: valueId,
    }));
  };

  const clearBulkFilters = () => {
    setBulkFilters({});
  };

  const applyBulkDraft = () => {
    const { patch, error } = buildBulkVariantPatch(bulkDraft);

    if (error) {
      toast.error(error);
      return;
    }

    if (Object.keys(patch).length === 0) {
      toast.error("Isi minimal satu nilai untuk diterapkan.");
      return;
    }

    if (matchedBulkCombinations.length === 0) {
      toast.error("Tidak ada SKU yang cocok dengan filter.");
      return;
    }

    setVariantDrafts((current) => {
      const next = { ...current };

      for (const combination of matchedBulkCombinations) {
        next[combination.key] = {
          ...getVariantDraft(current, combination.key),
          ...patch,
        };
      }

      return next;
    });
    toast.success(
      `Nilai massal diterapkan ke ${matchedBulkCombinations.length} SKU.`,
    );
  };

  // Menggunakan variationTypeOptions agar tipe yang baru ditambahkan ikut terhitung
  function getActiveVariationTypeIds() {
    return variationTypeOptions
      .map((variationType) => variationType.id)
      .filter((typeId) => (selectedVariations[typeId]?.length ?? 0) > 0);
  }

  // Tentukan daftar step aktif dan index step saat ini berdasarkan mode variasi
  const activeSteps =
    variationMode === "dengan" ? STEPS_DENGAN_VARIASI : STEPS_TANPA_VARIASI;
  const currentStepIndex = activeSteps.findIndex((s) => s.number === step);

  return (
    <div className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]">
      <WizardStepIndicator steps={activeSteps} currentIndex={currentStepIndex} />

      <div className="p-4 md:p-8">
        {step === 1 && (
          <div className="mx-auto max-w-[600px] space-y-6">
            <Field label="Nama Produk">
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="cth. Plastik HD"
                className="min-h-12 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[15px] text-[#201515] outline-none placeholder:text-[#939084] focus:border-[#ff4f00]"
              />
            </Field>
            <Field label="Kategori">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="min-h-12 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[15px] text-[#201515] outline-none focus:border-[#ff4f00]"
                >
                  <option value="">Pilih kategori...</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <CategoryQuickAdd
                  onCreated={handleCategoryCreated}
                  triggerLabel="Tambah"
                />
              </div>
            </Field>
            <Field label="Deskripsi">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Deskripsi produk (opsional)"
                rows={3}
                className="min-h-24 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 py-3 text-[15px] text-[#201515] outline-none placeholder:text-[#939084] focus:border-[#ff4f00]"
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="mx-auto max-w-[680px] space-y-6">
            {/* Header Step 2 */}
            <div>
              <h2 className="text-[22px] font-semibold text-[#201515] text-balance">
                Pilih Tipe Variasi
              </h2>
              <p className="mt-1 text-[15px] text-[#939084] text-pretty">
                Pilih tipe variasi yang berlaku untuk produk ini, atau pilih
                Tanpa Variasi jika produk tidak memiliki variasi.
              </p>
            </div>

            <div className="space-y-4">
              <div className="overflow-hidden rounded-[5px] border border-[#c5c0b1]">
                <button
                  type="button"
                  className={`flex min-h-14 w-full items-center gap-3 p-3 text-left ${
                    variationMode === "tanpa" ? "bg-[#eceae3]" : "bg-[#fffefb]"
                  }`}
                  onClick={() => handleVariationModeChange("tanpa")}
                >
                  {variationMode === "tanpa" ? (
                    <CheckSquare className="size-5 shrink-0 text-[#ff4f00]" />
                  ) : (
                    <Square className="size-5 shrink-0 text-[#939084]" />
                  )}
                  <span className="font-semibold text-[#201515]">
                    Tanpa Variasi
                  </span>
                </button>
              </div>

              {variationTypeOptions.length === 0 ? (
                <VariationTypeFallback
                  onAddClick={() => setTypeQuickAddOpen(true)}
                />
              ) : (
                variationTypeOptions.map((type) => (
                  <div
                    key={type.id}
                    className="overflow-hidden rounded-[5px] border border-[#c5c0b1]"
                  >
                    <button
                      type="button"
                      className={`flex min-h-14 w-full items-center gap-3 p-3 text-left ${
                        selectedVariations[type.id] !== undefined
                          ? "bg-[#eceae3]"
                          : "bg-[#fffefb]"
                      }`}
                      onClick={() => toggleVariationType(type.id)}
                    >
                      {selectedVariations[type.id] !== undefined ? (
                        <CheckSquare className="size-5 shrink-0 text-[#ff4f00]" />
                      ) : (
                        <Square className="size-5 shrink-0 text-[#939084]" />
                      )}
                      <span className="font-semibold text-[#201515]">
                        {type.name}
                      </span>
                    </button>

                    {selectedVariations[type.id] !== undefined && (
                      <div className="border-t border-[#c5c0b1] bg-[#fffefb] p-4">
                        <div className="flex flex-wrap gap-2">
                          {type.values.map((value) => {
                            const isSelected = selectedVariations[
                              type.id
                            ]?.includes(value.id);

                            return (
                              <button
                                key={value.id}
                                type="button"
                                onClick={() =>
                                  toggleVariationValue(type.id, value.id)
                                }
                                className={`min-h-10 rounded-[20px] border px-4 text-[14px] font-medium transition-colors ${
                                  isSelected
                                    ? "border-[#201515] bg-[#201515] text-[#fffefb]"
                                    : "border-[#c5c0b1] bg-[#fffefb] text-[#36342e] hover:bg-[#eceae3]"
                                }`}
                              >
                                {value.value}
                              </button>
                            );
                          })}
                          {/* Inline form tambah nilai variasi baru untuk tipe ini */}
                          <VariationValueQuickAdd
                            typeId={type.id}
                            onCreated={(v) =>
                              handleVariationValueCreated(type.id, v)
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* VariationTypeQuickAdd selalu tampil di bawah daftar */}
            <VariationTypeQuickAdd
              onCreated={handleVariationTypeCreated}
              open={typeQuickAddOpen}
              onOpenChange={setTypeQuickAddOpen}
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-[22px] font-semibold text-[#201515] text-balance">
                  Pilih Kombinasi SKU
                </h2>
                <p className="mt-1 text-[15px] text-[#939084] text-pretty">
                  Sistem membuat kombinasi dari variasi yang dipilih. Pilih
                  hanya kombinasi yang benar-benar tersedia untuk produk ini.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllCombinations}
                  disabled={
                    combinations.length === 0 || allCombinationsSelected
                  }
                  className="min-h-10 rounded-[5px] border border-[#c5c0b1] px-3 text-[14px] font-bold text-[#201515] disabled:opacity-50"
                >
                  Pilih semua
                </button>
                <button
                  type="button"
                  onClick={clearCombinationSelection}
                  disabled={selectedCombinations.length === 0}
                  className="min-h-10 rounded-[5px] border border-[#c5c0b1] px-3 text-[14px] font-bold text-[#201515] disabled:opacity-50"
                >
                  Hapus pilihan
                </button>
              </div>
            </div>

            <p className="text-[14px] font-semibold text-[#36342e]">
              {selectedCombinations.length} dari {combinations.length} kombinasi
              dipilih.
            </p>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {combinations.map((combination) => {
                const selected = selectedCombinationKeys.includes(
                  combination.key,
                );

                return (
                  <button
                    key={combination.key}
                    type="button"
                    onClick={() => toggleCombination(combination.key)}
                    className={`min-h-24 rounded-[5px] border p-4 text-left transition-colors ${
                      selected
                        ? "border-[#ff4f00] bg-[#ff4f00]/5"
                        : "border-[#c5c0b1] bg-[#fffefb] hover:bg-[#eceae3]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {selected ? (
                        <CheckSquare className="mt-0.5 size-5 shrink-0 text-[#ff4f00]" />
                      ) : (
                        <Square className="mt-0.5 size-5 shrink-0 text-[#939084]" />
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-1.5">
                          {combination.valueIds.map((valueId) => (
                            <span
                              key={valueId}
                              className="rounded-[3px] bg-[#ff4f00]/10 px-2 py-0.5 text-[12px] font-bold uppercase text-[#ff4f00]"
                            >
                              {valueMap.get(valueId)}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-[13px] text-[#939084]">
                          SKU akan dibuat otomatis
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 4 && variationMode === "tanpa" && (
          <div className="mx-auto max-w-[600px] space-y-6">
            <div>
              <h2 className="text-[22px] font-semibold text-[#201515] text-balance">
                Atur Harga dan Stok
              </h2>
              <p className="mt-1 text-[15px] text-[#939084] text-pretty">
                Boleh diisi 0 jika harga atau stok belum diketahui.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Harga">
                <NumericInput
                  ariaLabel="Harga produk"
                  value={singleVariantDraft.price}
                  inputMode="decimal"
                  onChange={(value) => updateSingleVariantDraft("price", value)}
                  onBlur={() => normalizeSingleVariantNumber("price")}
                />
              </Field>
              <Field label="Stok Awal">
                <NumericInput
                  ariaLabel="Stok awal produk"
                  value={singleVariantDraft.stock}
                  onChange={(value) => updateSingleVariantDraft("stock", value)}
                  onBlur={() => normalizeSingleVariantNumber("stock")}
                />
              </Field>
              <Field label="Min. Stok">
                <NumericInput
                  ariaLabel="Minimal stok produk"
                  value={singleVariantDraft.minStock}
                  onChange={(value) => updateSingleVariantDraft("minStock", value)}
                  onBlur={() => normalizeSingleVariantNumber("minStock")}
                />
              </Field>
            </div>
          </div>
        )}

        {step === 4 && variationMode === "dengan" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-[22px] font-semibold text-[#201515] text-balance">
                Atur Harga dan Stok
              </h2>
              <p className="mt-1 text-[15px] text-[#939084] text-pretty">
                Boleh diisi 0 jika harga atau stok belum diketahui. Data SKU
                bisa diedit nanti dari halaman edit produk.
              </p>
            </div>

            <BulkVariantApplyPanel
              activeVariationTypes={activeVariationTypes}
              selectedVariations={selectedVariations}
              valueMap={valueMap}
              isOpen={bulkEditorOpen}
              bulkFilters={bulkFilters}
              bulkDraft={bulkDraft}
              matchedCount={matchedBulkCombinations.length}
              onOpenChange={setBulkEditorOpen}
              onFilterChange={updateBulkFilter}
              onClearFilters={clearBulkFilters}
              onDraftChange={updateBulkDraft}
              onDraftBlur={normalizeBulkDraftNumber}
              onApply={applyBulkDraft}
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {selectedCombinations.map((combination) => {
                const draft = getVariantDraft(variantDrafts, combination.key);

                return (
                  <article
                    key={combination.key}
                    className="rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] p-4"
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {combination.valueIds.map((valueId) => (
                        <span
                          key={valueId}
                          className="rounded-[3px] bg-[#ff4f00]/10 px-2 py-0.5 text-[12px] font-bold uppercase text-[#ff4f00]"
                        >
                          {valueMap.get(valueId)}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-[13px] text-[#939084]">
                      SKU akan dibuat otomatis
                    </p>

                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <Field label="Harga">
                        <NumericInput
                          ariaLabel={`Harga ${formatCombinationName(combination, valueMap)}`}
                          value={draft.price}
                          inputMode="decimal"
                          onChange={(value) =>
                            updateVariantDraft(combination.key, "price", value)
                          }
                          onBlur={() =>
                            normalizeVariantNumber(combination.key, "price")
                          }
                        />
                      </Field>
                      <Field label="Stok Awal">
                        <NumericInput
                          ariaLabel={`Stok awal ${formatCombinationName(
                            combination,
                            valueMap,
                          )}`}
                          value={draft.stock}
                          onChange={(value) =>
                            updateVariantDraft(combination.key, "stock", value)
                          }
                          onBlur={() =>
                            normalizeVariantNumber(combination.key, "stock")
                          }
                        />
                      </Field>
                      <Field label="Min. Stok">
                        <NumericInput
                          ariaLabel={`Minimal stok ${formatCombinationName(
                            combination,
                            valueMap,
                          )}`}
                          value={draft.minStock}
                          onChange={(value) =>
                            updateVariantDraft(
                              combination.key,
                              "minStock",
                              value,
                            )
                          }
                          onBlur={() =>
                            normalizeVariantNumber(combination.key, "minStock")
                          }
                        />
                      </Field>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {step === 5 && (
          <ProductReviewStep
            name={name}
            categoryName={selectedCategoryName}
            description={description}
            activeVariationTypes={activeVariationTypes}
            reviewSummary={reviewSummary}
            valueMap={valueMap}
            variationMode={variationMode}
            singleVariantDraft={singleVariantDraft}
            onEditStock={() => setStep(4)}
          />
        )}
      </div>

      <div className="sticky bottom-0 z-20 flex items-center justify-between gap-3 border-t border-[#c5c0b1] bg-[#fffefb] p-4 shadow-sm md:static md:px-8 md:shadow-none">
        <button
          type="button"
          onClick={() => setStep(getPrevStep(step, variationMode))}
          disabled={step === 1 || loading}
          className="flex min-h-11 items-center gap-2 rounded-[4px] border border-[#c5c0b1] px-4 text-[14px] font-semibold text-[#201515] transition-colors hover:bg-[#eceae3] disabled:opacity-50"
        >
          <ArrowLeft className="size-4" /> Kembali
        </button>

        {step < 5 ? (
          <button
            type="button"
            onClick={() => setStep(getNextStep(step, variationMode))}
            disabled={!canGoNext()}
            className="flex min-h-11 items-center gap-2 rounded-[4px] bg-[#ff4f00] px-5 text-[14px] font-semibold text-[#fffefb] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {step === 4 ? "Review Produk" : "Lanjut"}{" "}
            <ChevronRight className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="flex min-h-11 items-center gap-2 rounded-[4px] bg-[#201515] px-5 text-[14px] font-semibold text-[#fffefb] transition-colors hover:bg-[#36342e] disabled:opacity-50"
          >
            {loading ? "Menyimpan..." : "Simpan Produk"}{" "}
            <Check className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-[14px] font-semibold text-[#201515]">
        {label}
      </label>
      {children}
    </div>
  );
}

function NumericInput({
  ariaLabel,
  value,
  onChange,
  onBlur,
  placeholder,
  inputMode = "numeric",
}: {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  placeholder?: string;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <input
      type="text"
      inputMode={inputMode}
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      className="min-h-12 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[16px] font-semibold tabular-nums text-[#201515] outline-none placeholder:text-[14px] placeholder:font-medium placeholder:text-[#939084] focus:border-[#ff4f00]"
    />
  );
}

function BulkVariantApplyPanel({
  activeVariationTypes,
  selectedVariations,
  valueMap,
  isOpen,
  bulkFilters,
  bulkDraft,
  matchedCount,
  onOpenChange,
  onFilterChange,
  onClearFilters,
  onDraftChange,
  onDraftBlur,
  onApply,
}: {
  activeVariationTypes: VariationType[];
  selectedVariations: Record<string, string[]>;
  valueMap: Map<string, string>;
  isOpen: boolean;
  bulkFilters: Record<string, string>;
  bulkDraft: VariantDraft;
  matchedCount: number;
  onOpenChange: (open: boolean) => void;
  onFilterChange: (typeId: string, valueId: string) => void;
  onClearFilters: () => void;
  onDraftChange: (field: keyof VariantDraft, value: string) => void;
  onDraftBlur: (field: keyof VariantDraft) => void;
  onApply: () => void;
}) {
  const hasFilter = Object.values(bulkFilters).some(
    (valueId) => valueId.length > 0,
  );
  const hasBulkValue = hasNonBlankBulkValue(bulkDraft);

  return (
    <section className="rounded-[5px] border border-[#c5c0b1] bg-[#eceae3]/35 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[16px] font-semibold text-[#201515]">
            Terapkan Massal
          </h3>
          <p className="mt-1 text-[13px] font-medium text-[#36342e]">
            Akan diterapkan ke {matchedCount} SKU
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(!isOpen)}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[4px] border border-[#c5c0b1] bg-[#fffefb] px-4 text-[14px] font-semibold text-[#201515] transition-colors hover:bg-[#eceae3] sm:w-auto"
        >
          <SlidersHorizontal className="size-4" />
          {isOpen ? "Tutup" : "Atur massal"}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 space-y-4 border-t border-[#c5c0b1] pt-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {activeVariationTypes.map((type) => (
              <Field key={type.id} label={type.name}>
                <select
                  value={bulkFilters[type.id] ?? ""}
                  onChange={(event) =>
                    onFilterChange(type.id, event.target.value)
                  }
                  className="min-h-12 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[15px] text-[#201515] outline-none focus:border-[#ff4f00]"
                >
                  <option value="">Semua {type.name}</option>
                  {(selectedVariations[type.id] ?? []).map((valueId) => (
                    <option key={valueId} value={valueId}>
                      {valueMap.get(valueId) ?? "Nilai variasi"}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Harga">
              <NumericInput
                ariaLabel="Harga massal"
                value={bulkDraft.price}
                inputMode="decimal"
                placeholder="Lewati"
                onChange={(value) => onDraftChange("price", value)}
                onBlur={() => onDraftBlur("price")}
              />
            </Field>
            <Field label="Stok Awal">
              <NumericInput
                ariaLabel="Stok awal massal"
                value={bulkDraft.stock}
                placeholder="Lewati"
                onChange={(value) => onDraftChange("stock", value)}
                onBlur={() => onDraftBlur("stock")}
              />
            </Field>
            <Field label="Min. Stok">
              <NumericInput
                ariaLabel="Minimal stok massal"
                value={bulkDraft.minStock}
                placeholder="Lewati"
                onChange={(value) => onDraftChange("minStock", value)}
                onBlur={() => onDraftBlur("minStock")}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[14px] font-semibold text-[#201515]">
                {matchedCount} SKU cocok
              </span>
              {hasFilter && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="min-h-10 rounded-[4px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[13px] font-semibold text-[#201515] transition-colors hover:bg-[#eceae3]"
                >
                  Reset filter
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onApply}
              disabled={matchedCount === 0 || !hasBulkValue}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[4px] bg-[#ff4f00] px-4 text-[14px] font-semibold text-[#fffefb] transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
            >
              Terapkan <Check className="size-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ProductReviewStep({
  name,
  categoryName,
  description,
  activeVariationTypes,
  reviewSummary,
  valueMap,
  variationMode,
  singleVariantDraft,
  onEditStock,
}: {
  name: string;
  categoryName: string;
  description: string;
  activeVariationTypes: VariationType[];
  reviewSummary: ReviewSummary;
  valueMap: Map<string, string>;
  variationMode: VariationMode;
  singleVariantDraft?: VariantDraft;
  onEditStock: () => void;
}) {
  const hasWarnings =
    variationMode === "tanpa"
      ? singleVariantDraft !== undefined &&
        Number(singleVariantDraft.price) === 0 &&
        Number(singleVariantDraft.stock) === 0 &&
        Number(singleVariantDraft.minStock) === 0
      : reviewSummary.allSkuValuesAreZero ||
        reviewSummary.allZeroCount > 0 ||
        reviewSummary.stockWithoutPriceCount > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[22px] font-semibold text-[#201515] text-balance">
            Review Produk
          </h2>
          <p className="mt-1 text-[15px] text-[#939084] text-pretty">
            Periksa kembali data produk dan SKU sebelum disimpan.
          </p>
        </div>
        <button
          type="button"
          onClick={onEditStock}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[4px] border border-[#c5c0b1] bg-[#fffefb] px-4 text-[14px] font-semibold text-[#201515] transition-colors hover:bg-[#eceae3] sm:w-auto"
        >
          <PencilLine className="size-4" />
          Edit harga & stok
        </button>
      </div>

      <section className="rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] p-4">
        <h3 className="text-[16px] font-semibold text-[#201515]">
          Informasi Produk
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ReviewInfo label="Nama Produk" value={name} />
          <ReviewInfo label="Kategori" value={categoryName} />
          <ReviewInfo
            label="Variasi"
            value={
              // Mode "tanpa": tampilkan label tetap; mode "dengan": daftar tipe aktif
              variationMode === "tanpa"
                ? "Tanpa Variasi"
                : activeVariationTypes.length > 0
                  ? activeVariationTypes.map((type) => type.name).join(", ")
                  : "-"
            }
          />
          <ReviewInfo
            label="Jumlah SKU"
            // Mode "tanpa": selalu 1 SKU; mode "dengan": jumlah dari reviewSummary
            value={variationMode === "tanpa" ? "1 SKU" : `${reviewSummary.skuList.length} SKU`}
          />
        </div>
        <div className="mt-3">
          <ReviewInfo
            label="Deskripsi"
            value={description.trim().length > 0 ? description : "-"}
          />
        </div>
      </section>

      {hasWarnings && (
        <section className="rounded-[5px] border border-[#d97706] bg-[#fff7ed] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#d97706]" />
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-[#201515]">
                Ada data SKU yang perlu dicek
              </h3>
              <div className="mt-2 space-y-1 text-[14px] text-[#6f4e1f]">
                {variationMode === "tanpa" ? (
                  // Peringatan khusus mode tanpa variasi: semua nilai masih 0
                  <p>
                    Harga, stok awal, dan min. stok masih bernilai 0.
                  </p>
                ) : (
                  <>
                    {reviewSummary.allSkuValuesAreZero && (
                      <p>
                        Semua SKU masih berisi harga, stok awal, dan min. stok 0.
                      </p>
                    )}
                    {reviewSummary.allZeroCount > 0 &&
                      !reviewSummary.allSkuValuesAreZero && (
                        <p>
                          {reviewSummary.allZeroCount} SKU masih berisi semua nilai
                          0.
                        </p>
                      )}
                    {reviewSummary.stockWithoutPriceCount > 0 && (
                      <p>
                        {reviewSummary.stockWithoutPriceCount} SKU punya stok awal
                        tetapi harga masih 0.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[16px] font-semibold text-[#201515]">
            Ringkasan SKU
          </h3>
          <span className="text-[13px] font-semibold text-[#939084]">
            {variationMode === "tanpa" ? "1 SKU" : `${reviewSummary.skuList.length} SKU`}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {variationMode === "tanpa" ? (
            // Mode tanpa variasi: satu kartu SKU tunggal tanpa chip nilai variasi
            <article
              className={`rounded-[5px] border bg-[#fffefb] p-4 ${
                hasWarnings ? "border-[#d97706]" : "border-[#c5c0b1]"
              }`}
            >
              {hasWarnings && (
                <div className="mb-3 flex items-start gap-2 rounded-[4px] bg-[#fff7ed] px-3 py-2 text-[13px] font-medium text-[#6f4e1f]">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#d97706]" />
                  <span>Semua nilai SKU ini masih 0.</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <ReviewMetric label="Harga" value={singleVariantDraft?.price ?? "0"} />
                <ReviewMetric label="Stok Awal" value={singleVariantDraft?.stock ?? "0"} />
                <ReviewMetric label="Min. Stok" value={singleVariantDraft?.minStock ?? "0"} />
              </div>
            </article>
          ) : (
            // Mode dengan variasi: render kartu per kombinasi SKU
            reviewSummary.skuList.map((item) => {
              const needsReview = item.isAllZero || item.hasStockWithoutPrice;

              return (
                <article
                  key={item.combination.key}
                  className={`rounded-[5px] border bg-[#fffefb] p-4 ${
                    needsReview ? "border-[#d97706]" : "border-[#c5c0b1]"
                  }`}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {item.combination.valueIds.map((valueId) => (
                      <span
                        key={valueId}
                        className="rounded-[3px] bg-[#ff4f00]/10 px-2 py-0.5 text-[12px] font-bold uppercase text-[#ff4f00]"
                      >
                        {valueMap.get(valueId)}
                      </span>
                    ))}
                  </div>

                  {needsReview && (
                    <div className="mt-3 flex items-start gap-2 rounded-[4px] bg-[#fff7ed] px-3 py-2 text-[13px] font-medium text-[#6f4e1f]">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#d97706]" />
                      <span>
                        {item.isAllZero
                          ? "Semua nilai SKU ini masih 0."
                          : "Stok awal sudah diisi, tetapi harga masih 0."}
                      </span>
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <ReviewMetric label="Harga" value={item.draft.price} />
                    <ReviewMetric label="Stok Awal" value={item.draft.stock} />
                    <ReviewMetric label="Min. Stok" value={item.draft.minStock} />
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function ReviewInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] font-bold uppercase text-[#939084]">{label}</p>
      <p className="mt-1 break-words text-[15px] font-semibold text-[#201515]">
        {value}
      </p>
    </div>
  );
}

function ReviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[4px] border border-[#c5c0b1] bg-[#eceae3]/35 px-2 py-2">
      <p className="text-[11px] font-bold uppercase text-[#939084]">{label}</p>
      <p className="mt-1 break-all text-[15px] font-semibold tabular-nums text-[#201515]">
        {value}
      </p>
    </div>
  );
}

function buildCombinations(
  variationTypes: VariationType[],
  selectedVariations: Record<string, string[]>,
): GeneratedCombination[] {
  const selectedRows = variationTypes
    .map((type) => ({
      typeId: type.id,
      valueIds: selectedVariations[type.id] ?? [],
    }))
    .filter((row) => row.valueIds.length > 0);

  if (selectedRows.length === 0) {
    return [];
  }

  const combinations: GeneratedCombination[] = [];

  function visit(rowIndex: number, current: string[]) {
    if (rowIndex === selectedRows.length) {
      combinations.push({
        key: createCombinationKey(current),
        valueIds: [...current],
      });
      return;
    }

    for (const valueId of selectedRows[rowIndex].valueIds) {
      current.push(valueId);
      visit(rowIndex + 1, current);
      current.pop();
    }
  }

  visit(0, []);
  return combinations;
}

function createCombinationKey(valueIds: string[]) {
  return valueIds.join("|");
}

function getVariantDraft(
  variantDrafts: Record<string, VariantDraft>,
  combinationKey: string,
) {
  return variantDrafts[combinationKey] ?? EMPTY_VARIANT_DRAFT;
}

function getMatchedBulkCombinations(
  selectedCombinations: GeneratedCombination[],
  activeVariationTypes: VariationType[],
  bulkFilters: Record<string, string>,
) {
  const activeTypeIds = new Set(activeVariationTypes.map((type) => type.id));
  const activeFilterValueIds = Object.entries(bulkFilters)
    .filter(
      ([typeId, valueId]) => activeTypeIds.has(typeId) && valueId.length > 0,
    )
    .map(([, valueId]) => valueId);

  if (activeFilterValueIds.length === 0) {
    return selectedCombinations;
  }

  return selectedCombinations.filter((combination) =>
    activeFilterValueIds.every((valueId) =>
      combination.valueIds.includes(valueId),
    ),
  );
}

function hasNonBlankBulkValue(bulkDraft: VariantDraft) {
  return Object.values(bulkDraft).some((value) => value.trim().length > 0);
}

function buildBulkVariantPatch(bulkDraft: VariantDraft): {
  patch: Partial<VariantDraft>;
  error: string | null;
} {
  const patch: Partial<VariantDraft> = {};

  if (bulkDraft.price.trim().length > 0) {
    if (!isValidNonNegativeNumber(bulkDraft.price)) {
      return { patch, error: "Harga massal harus berupa angka 0 atau lebih." };
    }

    patch.price = Number(bulkDraft.price).toString();
  }

  if (bulkDraft.stock.trim().length > 0) {
    if (!isValidNonNegativeInteger(bulkDraft.stock)) {
      return {
        patch,
        error: "Stok awal massal harus berupa angka bulat 0 atau lebih.",
      };
    }

    patch.stock = Number.parseInt(bulkDraft.stock, 10).toString();
  }

  if (bulkDraft.minStock.trim().length > 0) {
    if (!isValidNonNegativeInteger(bulkDraft.minStock)) {
      return {
        patch,
        error: "Minimal stok massal harus berupa angka bulat 0 atau lebih.",
      };
    }

    patch.minStock = Number.parseInt(bulkDraft.minStock, 10).toString();
  }

  return { patch, error: null };
}

function buildReviewSummary(
  selectedCombinations: GeneratedCombination[],
  variantDrafts: Record<string, VariantDraft>,
): ReviewSummary {
  const skuList = selectedCombinations.map((combination) => {
    const draft = getVariantDraft(variantDrafts, combination.key);
    const price = Number(draft.price);
    const stock = Number(draft.stock);
    const minStock = Number(draft.minStock);

    return {
      combination,
      draft,
      isAllZero: price === 0 && stock === 0 && minStock === 0,
      hasStockWithoutPrice: price === 0 && stock > 0,
    };
  });
  const allZeroCount = skuList.filter((sku) => sku.isAllZero).length;
  const stockWithoutPriceCount = skuList.filter(
    (sku) => sku.hasStockWithoutPrice,
  ).length;

  return {
    skuList,
    allSkuValuesAreZero: skuList.length > 0 && allZeroCount === skuList.length,
    allZeroCount,
    stockWithoutPriceCount,
  };
}

function validateVariantDrafts(
  selectedCombinations: GeneratedCombination[],
  variantDrafts: Record<string, VariantDraft>,
) {
  if (selectedCombinations.length === 0) {
    return "Pilih minimal satu kombinasi SKU.";
  }

  for (const combination of selectedCombinations) {
    const draft = getVariantDraft(variantDrafts, combination.key);

    if (!isValidNonNegativeNumber(draft.price)) {
      return "Harga SKU harus berupa angka 0 atau lebih.";
    }

    if (!isValidNonNegativeInteger(draft.stock)) {
      return "Stok awal SKU harus berupa angka bulat 0 atau lebih.";
    }

    if (!isValidNonNegativeInteger(draft.minStock)) {
      return "Minimal stok SKU harus berupa angka bulat 0 atau lebih.";
    }
  }

  return null;
}

function isValidNonNegativeInteger(value: string) {
  if (value.trim().length === 0) {
    return false;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0;
}

function isValidNonNegativeNumber(value: string) {
  if (value.trim().length === 0) {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function formatCombinationName(
  combination: GeneratedCombination,
  valueMap: Map<string, string>,
) {
  return combination.valueIds
    .map((valueId) => valueMap.get(valueId))
    .filter(Boolean)
    .join(" / ");
}
