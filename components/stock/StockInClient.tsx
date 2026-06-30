"use client";

import { useRouter } from "next/navigation";
import {
  FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { PackagePlus, Save } from "lucide-react";
import { StockInLine } from "@/components/stock/StockInLine";
import type { StockLine } from "@/types/stock";
import {
  type VariantSelectHandle,
  VariantSelect,
} from "@/components/stock/VariantSelect";
import type { StockVariantOption } from "@/components/stock/VariantSelect";

function newLine(variant: StockVariantOption): StockLine {
  return {
    lineId: `${variant.id}-${crypto.randomUUID()}`,
    variant,
    quantity: "",
  };
}

export function StockInClient() {
  const router = useRouter();
  const [lines, setLines] = useState<StockLine[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const searchRef = useRef<VariantSelectHandle>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const quantityRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingFocusLineId = useRef<string | null>(null);
  const pendingSearchFocus = useRef(false);

  const hasInvalidQuantity = lines.some(
    (line) => typeof line.quantity !== "number" || line.quantity <= 0,
  );
  const totalQuantity = useMemo(
    () =>
      lines.reduce(
        (total, line) =>
          total + (typeof line.quantity === "number" ? line.quantity : 0),
        0,
      ),
    [lines],
  );
  const submitDisabled = loading || lines.length === 0 || hasInvalidQuantity;

  const moveFocusInForm = (direction: -1 | 1) => {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const focusableElements = Array.from(
      form.querySelectorAll<HTMLElement>(
        [
          'input:not([disabled]):not([type="hidden"])',
          "textarea:not([disabled])",
          "button:not([disabled])",
          "select:not([disabled])",
          'a[href]',
          '[tabindex]:not([tabindex="-1"])',
        ].join(","),
      ),
    ).filter((element) => element.offsetParent !== null);

    if (focusableElements.length === 0) {
      return;
    }

    const activeElement = document.activeElement;
    const currentIndex =
      activeElement instanceof HTMLElement
        ? focusableElements.indexOf(activeElement)
        : -1;
    const nextIndex =
      currentIndex === -1
        ? direction > 0
          ? 0
          : focusableElements.length - 1
        : Math.min(
            Math.max(currentIndex + direction, 0),
            focusableElements.length - 1,
          );
    const nextElement = focusableElements[nextIndex];

    nextElement.focus();
    if (
      nextElement instanceof HTMLInputElement ||
      nextElement instanceof HTMLTextAreaElement
    ) {
      nextElement.select();
    }
    nextElement.scrollIntoView({ block: "nearest" });
  };

  const handleFormKeyDown = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if (event.defaultPrevented || !event.altKey) {
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocusInForm(-1);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocusInForm(1);
    }
  };

  useEffect(() => {
    if (!pendingFocusLineId.current) {
      if (pendingSearchFocus.current) {
        searchRef.current?.focus();
        pendingSearchFocus.current = false;
      }
      return;
    }

    quantityRefs.current[pendingFocusLineId.current]?.focus();
    quantityRefs.current[pendingFocusLineId.current]?.select();
    pendingFocusLineId.current = null;
  }, [lines]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key === "F2") {
        event.preventDefault();
        noteRef.current?.focus();
        return;
      }

      if (event.key === "F8") {
        event.preventDefault();
        if (!submitDisabled) {
          formRef.current?.requestSubmit();
        }
      }
    }

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [submitDisabled]);

  const handleAddVariant = (variant: StockVariantOption) => {
    if (lines.some((line) => line.variant.id === variant.id)) {
      toast.error("SKU sudah ada di daftar.");
      return;
    }

    const line = newLine(variant);
    pendingFocusLineId.current = line.lineId;
    setLines((current) => [...current, line]);
  };

  const updateQuantity = (lineId: string, quantity: number | "") => {
    setLines((current) =>
      current.map((line) =>
        line.lineId === lineId ? { ...line, quantity } : line,
      ),
    );
  };

  const focusQuantityAt = (index: number) => {
    const line = lines[index];
    if (!line) {
      return;
    }

    quantityRefs.current[line.lineId]?.focus();
    quantityRefs.current[line.lineId]?.select();
  };

  const removeLine = (lineId: string, index: number) => {
    const nextLine = lines[index + 1] ?? lines[index - 1];

    quantityRefs.current[lineId] = null;
    if (nextLine) {
      pendingFocusLineId.current = nextLine.lineId;
    } else {
      pendingSearchFocus.current = true;
    }
    setLines((current) => current.filter((line) => line.lineId !== lineId));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (lines.length === 0) {
      toast.error("Tambahkan minimal satu SKU.");
      return;
    }

    if (hasInvalidQuantity) {
      toast.error("Setiap SKU harus punya jumlah masuk yang valid.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/stock/in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((line) => ({
            variantId: line.variant.id,
            quantity: line.quantity,
          })),
          note: note.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal mencatat stok masuk.");
      }

      toast.success(data.message || "Stok masuk berhasil dicatat.");
      setLines([]);
      quantityRefs.current = {};
      setNote("");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal mencatat stok masuk.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[860px] space-y-6 pb-8">
      <header className="flex items-start gap-3">
        <PackagePlus className="mt-1 h-7 w-7 text-[#ff4f00]" />
        <div>
          <h1 className="text-[28px] font-semibold leading-[1] text-[#201515]">
            Barang Masuk
          </h1>
          <p className="mt-1 text-[15px] leading-[1.25] text-[#939084]">
            Catat kiriman baru dari supplier.
          </p>
        </div>
      </header>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        onKeyDown={handleFormKeyDown}
        className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]"
      >
        <div className="space-y-6 p-4 sm:p-6">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block text-[14px] font-bold text-[#201515]">
                Cari dan tambah SKU
              </label>
              <span className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
                {lines.length} SKU
              </span>
            </div>
            <VariantSelect
              ref={searchRef}
              onSelect={handleAddVariant}
              autoFocus
            />
          </div>

          <section className="space-y-3">
            {lines.length === 0 ? (
              <div className="rounded-[8px] border border-dashed border-[#c5c0b1] bg-[#fffefb] p-6 text-center">
                <p className="text-[15px] font-semibold text-[#201515]">
                  Belum ada SKU
                </p>
                <p className="mt-1 text-[13px] text-[#939084]">
                  Cari SKU di atas, lalu pilih untuk menambahkannya ke daftar.
                </p>
              </div>
            ) : (
              lines.map((line, index) => (
                <StockInLine
                  key={line.lineId}
                  index={index}
                  line={line}
                  onQuantityChange={updateQuantity}
                  onRemove={(lineId) => removeLine(lineId, index)}
                  quantityRef={(element) => {
                    quantityRefs.current[line.lineId] = element;
                  }}
                  onQuantityEnter={() => searchRef.current?.focus()}
                  onQuantityMovePrevious={
                    index > 0 ? () => focusQuantityAt(index - 1) : undefined
                  }
                  onQuantityMoveNext={
                    index < lines.length - 1
                      ? () => focusQuantityAt(index + 1)
                      : undefined
                  }
                />
              ))
            )}
          </section>

          <div>
            <label className="mb-2 block text-[14px] font-bold text-[#201515]">
              Catatan
            </label>
            <textarea
              ref={noteRef}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-24 w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 py-3 text-[15px] text-[#201515] outline-none placeholder:text-[#939084] focus:border-[#ff4f00]"
              placeholder="Contoh: kiriman supplier pagi"
            />
          </div>
        </div>

        <div className="border-t border-[#c5c0b1] bg-[#fffefb] p-4 sm:static sm:p-6">
          <div className="mb-3 flex items-center justify-between text-[13px] font-semibold text-[#36342e]">
            <span>Total SKU: {lines.length}</span>
            <span>Total qty: {totalQuantity}</span>
          </div>
          <button
            type="submit"
            disabled={submitDisabled}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[8px] border border-[#ff4f00] bg-[#ff4f00] px-5 text-[15px] font-bold text-[#fffefb] outline-none transition-colors hover:bg-[#e64600] focus-visible:border-[#201515] focus-visible:ring-3 focus-visible:ring-[#ff4f00]/35 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#fffefb]/35 border-t-[#fffefb]" />
            ) : (
              <>
                <Save className="h-5 w-5" />
                Simpan Barang Masuk
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
