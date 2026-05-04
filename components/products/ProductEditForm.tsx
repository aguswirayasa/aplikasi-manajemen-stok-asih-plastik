"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/ui/confirm-action";

type ProductEditCategory = {
  id: string;
  name: string;
};

type ProductEditVariant = {
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

type ProductEditProduct = {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  variants: ProductEditVariant[];
};

type ProductEditFormProps = {
  product: ProductEditProduct;
  categories: ProductEditCategory[];
};

type VariantDraft = {
  id: string;
  sku: string;
  price: string;
  stock: string;
  minStock: string;
  isActive: boolean;
  values: ProductEditVariant["values"];
};

type ProductDraft = {
  name: string;
  categoryId: string;
  description: string;
  variants: VariantDraft[];
};

type NormalizedVariantUpdate = {
  id: string;
  price: number;
  stock: number;
  minStock: number;
  isActive: boolean;
};

type NormalizedProductUpdate = {
  name: string;
  categoryId: string;
  description: string;
  variants: NormalizedVariantUpdate[];
};

export function ProductEditForm({
  product,
  categories,
}: ProductEditFormProps) {
  const router = useRouter();
  const initialDraft = useMemo(() => createDraft(product), [product]);
  const [draft, setDraft] = useState<ProductDraft>(initialDraft);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    createSnapshot(initialDraft)
  );
  const [saving, setSaving] = useState(false);

  const currentSnapshot = useMemo(() => createSnapshot(draft), [draft]);
  const dirty = currentSnapshot !== savedSnapshot;
  const validationMessage = useMemo(() => validateDraft(draft), [draft]);

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const updateVariant = (
    variantId: string,
    patch: Partial<Omit<VariantDraft, "id" | "sku" | "values">>
  ) => {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) =>
        variant.id === variantId ? { ...variant, ...patch } : variant
      ),
    }));
  };

  const normalizeVariantNumber = (
    variantId: string,
    field: "price" | "stock" | "minStock"
  ) => {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) => {
        if (variant.id !== variantId) {
          return variant;
        }

        const value = variant[field].trim();

        if (value.length === 0) {
          return variant;
        }

        const parsed = field === "price" ? Number(value) : Number.parseInt(value, 10);

        if (!Number.isFinite(parsed) || parsed < 0) {
          return variant;
        }

        return { ...variant, [field]: parsed.toString() };
      }),
    }));
  };

  const handleSave = async () => {
    const message = validateDraft(draft);

    if (message) {
      toast.error(message);
      return;
    }

    const payload = normalizeDraft(draft);

    setSaving(true);
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal menyimpan perubahan produk.");
      }

      const normalizedDraft = draftFromNormalized(payload, draft);
      setDraft(normalizedDraft);
      setSavedSnapshot(createSnapshot(normalizedDraft));
      toast.success(data.message || "Perubahan produk berhasil disimpan.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan perubahan produk."
      );
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    router.push(`/products/${product.id}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <BackAction dirty={dirty} onBack={goBack} />
        {dirty && (
          <p className="text-[13px] font-semibold text-[#ff4f00]">
            Ada perubahan yang belum disimpan.
          </p>
        )}
      </div>

      <section className="rounded-[8px] border border-[#c5c0b1] bg-[#fffefb] p-4 sm:p-6">
        <h2 className="text-[18px] font-semibold text-[#201515]">
          Informasi Produk
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-[14px] font-bold text-[#201515]">
              Nama Produk
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              className="min-h-12 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[15px] text-[#201515] outline-none focus:border-[#ff4f00]"
            />
          </div>
          <div>
            <label className="mb-2 block text-[14px] font-bold text-[#201515]">
              Kategori
            </label>
            <select
              value={draft.categoryId}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  categoryId: event.target.value,
                }))
              }
              className="min-h-12 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[15px] text-[#201515] outline-none focus:border-[#ff4f00]"
            >
              <option value="">Pilih kategori...</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-[14px] font-bold text-[#201515]">
              Deskripsi
            </label>
            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              rows={3}
              className="min-h-24 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 py-3 text-[15px] text-[#201515] outline-none focus:border-[#ff4f00]"
              placeholder="Deskripsi produk (opsional)"
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]">
        <div className="border-b border-[#c5c0b1] bg-[#eceae3]/50 p-4">
          <h2 className="text-[18px] font-semibold text-[#201515]">
            Matriks SKU
          </h2>
          <p className="mt-1 text-[13px] text-[#939084]">
            Isi stok sebagai jumlah akhir. Sistem akan mencatat selisihnya di
            riwayat stok.
          </p>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#c5c0b1]">
                <th className="p-4 font-semibold text-[#201515]">
                  SKU / Variasi
                </th>
                <th className="p-4 font-semibold text-[#201515]">Harga</th>
                <th className="p-4 font-semibold text-[#201515]">Stok Akhir</th>
                <th className="p-4 font-semibold text-[#201515]">Min. Stok</th>
                <th className="p-4 text-center font-semibold text-[#201515]">
                  Aktif
                </th>
              </tr>
            </thead>
            <tbody>
              {draft.variants.map((variant) => (
                <tr
                  key={variant.id}
                  className={`border-b border-[#c5c0b1] last:border-0 ${
                    !variant.isActive ? "bg-[#eceae3]/50 opacity-70" : ""
                  }`}
                >
                  <td className="p-4">
                    <p className="font-bold text-[#201515]">{variant.sku}</p>
                    <p className="mt-0.5 text-[13px] text-[#939084]">
                      {formatVariantValues(variant.values)}
                    </p>
                  </td>
                  <td className="p-4">
                    <NumericInput
                      ariaLabel={`Harga ${variant.sku}`}
                      value={variant.price}
                      inputMode="decimal"
                      onChange={(value) => updateVariant(variant.id, { price: value })}
                      onBlur={() => normalizeVariantNumber(variant.id, "price")}
                    />
                  </td>
                  <td className="p-4">
                    <NumericInput
                      ariaLabel={`Stok akhir ${variant.sku}`}
                      value={variant.stock}
                      onChange={(value) => updateVariant(variant.id, { stock: value })}
                      onBlur={() => normalizeVariantNumber(variant.id, "stock")}
                    />
                  </td>
                  <td className="p-4">
                    <NumericInput
                      ariaLabel={`Minimum stok ${variant.sku}`}
                      value={variant.minStock}
                      onChange={(value) =>
                        updateVariant(variant.id, { minStock: value })
                      }
                      onBlur={() => normalizeVariantNumber(variant.id, "minStock")}
                    />
                  </td>
                  <td className="p-4">
                    <Toggle
                      checked={variant.isActive}
                      label={`Status aktif ${variant.sku}`}
                      onChange={(checked) =>
                        updateVariant(variant.id, { isActive: checked })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-[#c5c0b1] md:hidden">
          {draft.variants.map((variant) => (
            <article
              key={variant.id}
              className={`space-y-4 p-4 ${!variant.isActive ? "bg-[#eceae3]/50 opacity-70" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-[16px] font-bold text-[#201515]">
                    {variant.sku}
                  </p>
                  <p className="mt-1 break-words text-[13px] text-[#939084]">
                    {formatVariantValues(variant.values)}
                  </p>
                </div>
                <Toggle
                  checked={variant.isActive}
                  label={`Status aktif ${variant.sku}`}
                  onChange={(checked) =>
                    updateVariant(variant.id, { isActive: checked })
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Harga">
                  <NumericInput
                    ariaLabel={`Harga ${variant.sku}`}
                    value={variant.price}
                    inputMode="decimal"
                    onChange={(value) => updateVariant(variant.id, { price: value })}
                    onBlur={() => normalizeVariantNumber(variant.id, "price")}
                  />
                </Field>
                <Field label="Stok Akhir">
                  <NumericInput
                    ariaLabel={`Stok akhir ${variant.sku}`}
                    value={variant.stock}
                    onChange={(value) => updateVariant(variant.id, { stock: value })}
                    onBlur={() => normalizeVariantNumber(variant.id, "stock")}
                  />
                </Field>
                <Field label="Min. Stok">
                  <NumericInput
                    ariaLabel={`Minimum stok ${variant.sku}`}
                    value={variant.minStock}
                    onChange={(value) =>
                      updateVariant(variant.id, { minStock: value })
                    }
                    onBlur={() => normalizeVariantNumber(variant.id, "minStock")}
                  />
                </Field>
              </div>
            </article>
          ))}
        </div>
      </section>

      {validationMessage && (
        <div className="flex items-start gap-2 rounded-[6px] border border-[#ff4f00] bg-[#ff4f00]/5 p-3 text-[14px] font-semibold text-[#ff4f00]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {validationMessage}
        </div>
      )}

      <div className="sticky bottom-16 z-20 rounded-[8px] border border-[#c5c0b1] bg-[#fffefb] p-4 shadow-sm md:bottom-0">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving || Boolean(validationMessage)}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[8px] border border-[#ff4f00] bg-[#ff4f00] px-5 text-[15px] font-bold text-[#fffefb] transition-colors hover:bg-[#e64600] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <>
              <span className="h-5 w-5 rounded-full border-2 border-[#fffefb]/35 border-t-[#fffefb] animate-spin" />
              Menyimpan...
            </>
          ) : (
            <>
              <Save className="h-5 w-5" />
              Simpan Perubahan
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function BackAction({
  dirty,
  onBack,
}: {
  dirty: boolean;
  onBack: () => void;
}) {
  const button = (onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-4 text-[14px] font-bold text-[#201515] hover:bg-[#eceae3]"
    >
      <ArrowLeft className="h-4 w-4" /> Kembali ke Detail Produk
    </button>
  );

  if (!dirty) {
    return button(onBack);
  }

  return (
    <ConfirmAction
      title="Tinggalkan halaman?"
      message="Perubahan yang belum disimpan akan hilang."
      confirmLabel="Tinggalkan"
      onConfirm={onBack}
      trigger={(open) => button(open)}
    />
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
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
  inputMode = "numeric",
}: {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <input
      type="text"
      inputMode={inputMode}
      aria-label={ariaLabel}
      value={value}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      className="min-h-12 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 text-[16px] font-semibold tabular-nums text-[#201515] outline-none focus:border-[#ff4f00] md:w-[120px]"
    />
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-center">
      <span className="sr-only">{label}</span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        className={`relative block h-6 w-10 rounded-[20px] transition-colors ${
          checked ? "bg-[#ff4f00]" : "bg-[#c5c0b1]"
        }`}
      >
        <span
          className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-[#fffefb] transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
    </label>
  );
}

function createDraft(product: ProductEditProduct): ProductDraft {
  return {
    name: product.name,
    categoryId: product.categoryId,
    description: product.description,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      price: normalizeNumericString(variant.price),
      stock: variant.stock.toString(),
      minStock: variant.minStock.toString(),
      isActive: variant.isActive,
      values: variant.values,
    })),
  };
}

function createSnapshot(draft: ProductDraft) {
  return JSON.stringify({
    name: draft.name.trim(),
    categoryId: draft.categoryId,
    description: draft.description.trim(),
    variants: draft.variants.map((variant) => ({
      id: variant.id,
      price: normalizeNumericString(variant.price),
      stock: normalizeNumericString(variant.stock),
      minStock: normalizeNumericString(variant.minStock),
      isActive: variant.isActive,
    })),
  });
}

function validateDraft(draft: ProductDraft) {
  if (draft.name.trim().length === 0) {
    return "Nama produk wajib diisi.";
  }

  if (draft.categoryId.length === 0) {
    return "Kategori produk wajib dipilih.";
  }

  for (const variant of draft.variants) {
    if (!isValidNonNegativeNumber(variant.price)) {
      return `Harga ${variant.sku} tidak valid.`;
    }

    if (!isValidNonNegativeInteger(variant.stock)) {
      return `Stok ${variant.sku} harus berupa angka bulat 0 atau lebih.`;
    }

    if (!isValidNonNegativeInteger(variant.minStock)) {
      return `Minimum stok ${variant.sku} harus berupa angka bulat 0 atau lebih.`;
    }

  }

  return null;
}

function normalizeDraft(draft: ProductDraft): NormalizedProductUpdate {
  return {
    name: draft.name.trim(),
    categoryId: draft.categoryId,
    description: draft.description.trim(),
    variants: draft.variants.map((variant) => ({
      id: variant.id,
      price: Number(variant.price),
      stock: Number.parseInt(variant.stock, 10),
      minStock: Number.parseInt(variant.minStock, 10),
      isActive: variant.isActive,
    })),
  };
}

function draftFromNormalized(
  normalized: NormalizedProductUpdate,
  draft: ProductDraft
): ProductDraft {
  const normalizedVariants = new Map(
    normalized.variants.map((variant) => [variant.id, variant])
  );

  return {
    name: normalized.name,
    categoryId: normalized.categoryId,
    description: normalized.description,
    variants: draft.variants.map((variant) => {
      const normalizedVariant = normalizedVariants.get(variant.id);

      if (!normalizedVariant) {
        return variant;
      }

      return {
        ...variant,
        price: normalizedVariant.price.toString(),
        stock: normalizedVariant.stock.toString(),
        minStock: normalizedVariant.minStock.toString(),
        isActive: normalizedVariant.isActive,
      };
    }),
  };
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

function normalizeNumericString(value: string) {
  if (value.trim().length === 0) {
    return value;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return value;
  }

  return parsed.toString();
}

function formatVariantValues(values: ProductEditVariant["values"]) {
  return (
    values
      .map((value) => value.variationValue.value)
      .filter(Boolean)
      .join(" / ") || "Tanpa variasi"
  );
}
