"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent } from "react";
import { AlertCircle, Package, Search } from "lucide-react";

export type StockVariantOption = {
  id: string;
  sku: string;
  stock: number;
  minStock: number;
  price: string | number;
  isActive: boolean;
  productName: string;
  variationString: string;
};

type ApiProduct = {
  name: string;
  variants: Array<{
    id: string;
    sku: string;
    stock: number;
    minStock: number;
    price: string | number;
    isActive: boolean;
    values: Array<{
      variationValue: {
        value: string;
        variationType?: {
          name: string;
        };
      };
    }>;
  }>;
};

type VariantSelectProps = {
  onSelect: (variant: StockVariantOption) => void;
  error?: boolean;
  autoFocus?: boolean;
};

export type VariantSelectHandle = {
  focus: () => void;
};

function toVariantOptions(products: ApiProduct[]): StockVariantOption[] {
  return products.flatMap((product) =>
    product.variants
      .filter((variant) => variant.isActive)
      .map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        stock: variant.stock,
        minStock: variant.minStock,
        price: variant.price,
        isActive: variant.isActive,
        productName: product.name,
        variationString: variant.values
          .map((item) => item.variationValue.value)
          .join(" / "),
      }))
  );
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

export const VariantSelect = forwardRef<VariantSelectHandle, VariantSelectProps>(
  function VariantSelect({ onSelect, error, autoFocus }, ref) {
    const [variants, setVariants] = useState<StockVariantOption[]>([]);
    const [search, setSearch] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [lastSelectedVariantId, setLastSelectedVariantId] = useState<
      string | null
    >(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const listboxId = useId();

    const focusInput = useCallback(() => {
      inputRef.current?.focus();
      setIsOpen(true);
    }, []);

    useImperativeHandle(ref, () => ({ focus: focusInput }), [focusInput]);

    useEffect(() => {
      let isMounted = true;

      async function loadProducts() {
        try {
          const response = await fetch("/api/products");
          const json = await response.json();

          if (!response.ok) {
            throw new Error(json.error || "Gagal memuat SKU.");
          }

          if (isMounted) {
            setVariants(toVariantOptions(json.data || []));
            setLoadError(null);
          }
        } catch (err) {
          if (isMounted) {
            setLoadError(
              err instanceof Error ? err.message : "Gagal memuat SKU.",
            );
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      }

      loadProducts();

      return () => {
        isMounted = false;
      };
    }, []);

    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      }

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
      if (autoFocus) {
        inputRef.current?.focus();
      }
    }, [autoFocus]);

    useEffect(() => {
      function handleGlobalShortcut(event: globalThis.KeyboardEvent) {
        if (event.key === "F3") {
          event.preventDefault();
          focusInput();
          return;
        }

        if (event.key !== "/" || isEditableTarget(event.target)) {
          return;
        }

        event.preventDefault();
        focusInput();
      }

      document.addEventListener("keydown", handleGlobalShortcut);
      return () => document.removeEventListener("keydown", handleGlobalShortcut);
    }, [focusInput]);

    const filteredVariants = useMemo(() => {
      const query = search.trim().toLowerCase();

      if (!query) {
        return variants;
      }

      return variants.filter(
        (variant) =>
          variant.sku.toLowerCase().includes(query) ||
          variant.productName.toLowerCase().includes(query) ||
          variant.variationString.toLowerCase().includes(query),
      );
    }, [search, variants]);

    useEffect(() => {
      const query = search.trim();

      if (query) {
        setActiveIndex(0);
        return;
      }

      setActiveIndex((current) => {
        if (lastSelectedVariantId) {
          const selectedIndex = filteredVariants.findIndex(
            (variant) => variant.id === lastSelectedVariantId,
          );

          if (selectedIndex >= 0) {
            return selectedIndex;
          }
        }

        return Math.min(current, Math.max(filteredVariants.length - 1, 0));
      });
    }, [filteredVariants, lastSelectedVariantId, search]);

    useEffect(() => {
      if (!isOpen) {
        return;
      }

      const activeVariant = filteredVariants[activeIndex];
      if (!activeVariant) {
        return;
      }

      optionRefs.current[activeVariant.id]?.scrollIntoView({
        block: "nearest",
      });
    }, [activeIndex, filteredVariants, isOpen]);

    const selectVariant = useCallback(
      (variant: StockVariantOption) => {
        onSelect(variant);
        setLastSelectedVariantId(variant.id);
        setSearch("");
        setIsOpen(false);
      },
      [onSelect],
    );

    const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSearch("");
        setIsOpen(false);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setIsOpen(true);
        setActiveIndex((current) =>
          filteredVariants.length === 0
            ? 0
            : Math.min(current + 1, filteredVariants.length - 1),
        );
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        setIsOpen(true);
        setActiveIndex(0);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        setIsOpen(true);
        setActiveIndex(Math.max(filteredVariants.length - 1, 0));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setIsOpen(true);
        setActiveIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === "Enter" && isOpen && filteredVariants[activeIndex]) {
        event.preventDefault();
        selectVariant(filteredVariants[activeIndex]);
      }
    };

    const activeOptionId =
      isOpen && filteredVariants[activeIndex]
        ? `${listboxId}-option-${filteredVariants[activeIndex].id}`
        : undefined;

    return (
      <div className="relative" ref={containerRef}>
        <div
          className={`flex min-h-12 items-center gap-3 rounded-[5px] border ${
            error ? "border-[#ff4f00]" : "border-[#c5c0b1]"
          } bg-[#fffefb] px-3 focus-within:border-[#ff4f00]`}
          onClick={() => setIsOpen(true)}
        >
          <Search className="h-5 w-5 shrink-0 text-[#939084]" />
          <input
            ref={inputRef}
            type="search"
            aria-label="Cari SKU atau nama produk"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            role="combobox"
            placeholder="Cari SKU atau nama produk"
            className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-[#201515] outline-none placeholder:text-[#939084]"
            value={search}
            onFocus={() => setIsOpen(true)}
            onChange={(event) => {
              setSearch(event.target.value);
              setIsOpen(true);
            }}
            onKeyDown={handleInputKeyDown}
          />
        </div>

        {isOpen && (
          <div
            id={listboxId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[320px] overflow-y-auto rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]"
          >
            {loading ? (
              <div className="p-4 text-center text-[14px] text-[#939084]">
                Memuat SKU...
              </div>
            ) : loadError ? (
              <div className="flex items-center gap-2 p-4 text-[14px] text-[#ff4f00]">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {loadError}
              </div>
            ) : filteredVariants.length === 0 ? (
              <div className="p-4 text-center text-[14px] text-[#939084]">
                SKU tidak ditemukan.
              </div>
            ) : (
              <div className="divide-y divide-[#eceae3]">
                {filteredVariants.map((variant, index) => (
                  <button
                    type="button"
                    key={variant.id}
                    ref={(element) => {
                      optionRefs.current[variant.id] = element;
                    }}
                    id={`${listboxId}-option-${variant.id}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    tabIndex={-1}
                    className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-[#eceae3]/45 focus:bg-[#eceae3]/45 focus:outline-none ${
                      index === activeIndex ? "bg-[#eceae3]/45" : ""
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectVariant(variant);
                    }}
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] border border-[#c5c0b1] text-[#ff4f00]">
                        <Package className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-bold text-[#201515]">
                          {variant.sku}
                        </span>
                        <span className="block truncate text-[13px] text-[#36342e]">
                          {variant.productName}
                        </span>
                        {variant.variationString && (
                          <span className="block truncate text-[12px] text-[#939084]">
                            {variant.variationString}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
                        Stok
                      </span>
                      <span
                        className={`block text-[16px] font-bold ${
                          variant.stock <= variant.minStock
                            ? "text-[#ff4f00]"
                            : "text-[#201515]"
                        }`}
                      >
                        {variant.stock}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);
