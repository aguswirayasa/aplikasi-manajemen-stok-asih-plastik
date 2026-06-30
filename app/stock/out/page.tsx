"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ExternalLink, PackageMinus, Printer, ReceiptText } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { SaleReceipt } from "@/components/stock/SaleReceipt";
import { StockOutCartLine } from "@/components/stock/StockOutCartLine";
import { StockOutSummary } from "@/components/stock/StockOutSummary";
import { getStockVariantPrice } from "@/lib/stock-format";
import type { StockLine } from "@/types/stock";
import type { SaleReceiptData } from "@/types/sales";
import {
  type VariantSelectHandle,
  StockVariantOption,
  VariantSelect,
} from "@/components/stock/VariantSelect";

function newLine(variant: StockVariantOption): StockLine {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    lineId: `${variant.id}-${randomPart}`,
    variant,
    quantity: 1,
  };
}

export default function StockOutPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [lines, setLines] = useState<StockLine[]>([]);
  const [paidAmount, setPaidAmount] = useState("");
  const [completedSale, setCompletedSale] = useState<SaleReceiptData | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<VariantSelectHandle>(null);
  const paidAmountRef = useRef<HTMLInputElement>(null);
  const quantityRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingFocusLineId = useRef<string | null>(null);
  const pendingSearchFocus = useRef(false);
  const printReceipt = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: completedSale?.receiptNumber || "struk-penjualan",
  });

  const hasInvalidQuantity = lines.some(
    (line) => typeof line.quantity !== "number" || line.quantity <= 0,
  );
  const hasOverStock = lines.some(
    (line) =>
      typeof line.quantity === "number" && line.quantity > line.variant.stock,
  );
  const totals = useMemo(
    () =>
      lines.reduce(
        (summary, line) => {
          const quantity =
            typeof line.quantity === "number" ? line.quantity : 0;
          return {
            quantity: summary.quantity + quantity,
            amount:
              summary.amount + quantity * getStockVariantPrice(line.variant),
          };
        },
        { quantity: 0, amount: 0 },
      ),
    [lines],
  );
  const numericPaidAmount = Number(paidAmount || 0);
  const changeAmount = numericPaidAmount - totals.amount;
  const hasInvalidPaidAmount =
    paidAmount.trim().length === 0 ||
    !Number.isFinite(numericPaidAmount) ||
    numericPaidAmount < 0;
  const hasUnderpaid =
    lines.length > 0 && !hasInvalidPaidAmount && numericPaidAmount < totals.amount;

  const cashierName =
    session?.user?.name || session?.user?.username || "Kasir aktif";

  const submitDisabled =
    loading ||
    lines.length === 0 ||
    hasInvalidQuantity ||
    hasOverStock ||
    hasInvalidPaidAmount ||
    hasUnderpaid;

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
        paidAmountRef.current?.focus();
        paidAmountRef.current?.select();
        return;
      }

      if (event.key === "F8") {
        event.preventDefault();
        if (!submitDisabled) {
          formRef.current?.requestSubmit();
        }
        return;
      }

      if (event.key === "F9" && completedSale) {
        event.preventDefault();
        printReceipt();
      }
    }

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [completedSale, printReceipt, submitDisabled]);

  const handleAddVariant = (variant: StockVariantOption) => {
    const existingLine = lines.find((line) => line.variant.id === variant.id);

    if (existingLine) {
      pendingFocusLineId.current = existingLine.lineId;
      updateQuantity(
        existingLine.lineId,
        typeof existingLine.quantity === "number"
          ? existingLine.quantity + 1
          : 1,
      );
      toast.success("Jumlah SKU ditambah.");
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

  const clearCart = () => {
    setLines([]);
    quantityRefs.current = {};
    pendingSearchFocus.current = true;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (lines.length === 0) {
      toast.error("Tambahkan minimal satu SKU.");
      return;
    }

    if (hasInvalidQuantity) {
      toast.error("Setiap SKU harus punya jumlah keluar yang valid.");
      return;
    }

    if (hasOverStock) {
      toast.error("Ada jumlah keluar yang melebihi stok tersedia.");
      return;
    }

    if (hasInvalidPaidAmount || hasUnderpaid) {
      toast.error("Uang dibayar harus cukup untuk total transaksi.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((line) => ({
            variantId: line.variant.id,
            quantity: line.quantity,
          })),
          paidAmount: numericPaidAmount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal mencatat transaksi kasir.");
      }

      const sale = data.data as SaleReceiptData;

      setCompletedSale(sale);
      setPaidAmount("");
      toast.success(data.message || "Transaksi penjualan berhasil dicatat.");
      clearCart();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mencatat transaksi kasir.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onKeyDown={handleFormKeyDown}
      className="mx-auto max-w-[1180px] pb-8"
    >
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-start gap-3">
          <PackageMinus className="mt-1 h-7 w-7 text-[#ff4f00]" />
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
              POS Kasir
            </p>
            <h1 className="text-[30px] font-semibold leading-[1] text-[#201515]">
              Checkout Barang Keluar
            </h1>
            <p className="mt-1 text-[15px] leading-[1.25] text-[#939084]">
              Catat barang keluar dalam satu transaksi kasir.
            </p>
          </div>
        </div>
        <div className="rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-4 py-3 text-[13px]">
          <p className="font-semibold uppercase tracking-[0.5px] text-[#939084]">
            Kasir
          </p>
          <p className="mt-1 font-bold text-[#201515]">{cashierName}</p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]">
          <div className="border-b border-[#c5c0b1] p-4 sm:p-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block text-[14px] font-bold text-[#201515]">
                Cari dan tambah produk
              </label>
              <span className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
                {lines.length} item
              </span>
            </div>
            <VariantSelect
              ref={searchRef}
              onSelect={handleAddVariant}
              error={hasOverStock}
              autoFocus
            />
          </div>

          <div className="p-4 sm:p-5">
            {lines.length === 0 ? (
              <div className="rounded-[8px] border border-dashed border-[#c5c0b1] bg-[#fffefb] p-8 text-center">
                <ReceiptText className="mx-auto mb-3 h-9 w-9 text-[#c5c0b1]" />
                <p className="text-[16px] font-bold text-[#201515]">
                  Cart masih kosong
                </p>
                <p className="mt-1 text-[13px] text-[#939084]">
                  Cari SKU atau nama produk, lalu pilih item untuk mulai
                  checkout.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {lines.map((line, index) => (
                  <StockOutCartLine
                    key={line.lineId}
                    index={index}
                    line={line}
                    onQuantityChange={updateQuantity}
                    onRemove={(lineId) => removeLine(lineId, index)}
                    quantityRef={(element) => {
                      quantityRefs.current[line.lineId] = element;
                    }}
                    onQuantityEnter={() => searchRef.current?.focus()}
                    onQuantityMovePrevious={() => focusQuantityAt(index - 1)}
                    onQuantityMoveNext={() => focusQuantityAt(index + 1)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <StockOutSummary
          lineCount={lines.length}
          totalQuantity={totals.quantity}
          totalAmount={totals.amount}
          paidAmount={paidAmount}
          changeAmount={changeAmount}
          hasOverStock={hasOverStock}
          hasUnderpaid={hasUnderpaid}
          loading={loading}
          submitDisabled={submitDisabled}
          onPaidAmountChange={setPaidAmount}
          onClearCart={clearCart}
          paidAmountRef={paidAmountRef}
          onPaidAmountEnter={() => {
            if (!submitDisabled) {
              formRef.current?.requestSubmit();
            }
          }}
        />
      </div>

      {completedSale && (
        <section className="mt-5 grid gap-4 rounded-[8px] border border-[#c5c0b1] bg-[#fffefb] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
              Transaksi selesai
            </p>
            <p className="mt-1 text-[18px] font-bold text-[#201515]">
              {completedSale.receiptNumber}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={printReceipt}
              className="inline-flex min-h-11 items-center gap-2 rounded-[5px] border border-[#ff4f00] bg-[#ff4f00] px-4 text-[14px] font-bold text-[#fffefb] outline-none hover:bg-[#e64600] focus-visible:border-[#201515] focus-visible:ring-3 focus-visible:ring-[#ff4f00]/35"
            >
              <Printer className="h-4 w-4" />
              Cetak struk
            </button>
            <Link
              href={`/sales/${completedSale.id}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-4 text-[14px] font-bold text-[#201515] outline-none hover:bg-[#eceae3] focus-visible:border-[#ff4f00] focus-visible:ring-3 focus-visible:ring-[#ff4f00]/35"
            >
              <ExternalLink className="h-4 w-4" />
              Detail
            </Link>
          </div>
          <div className="fixed -left-[10000px] top-0">
            <SaleReceipt ref={receiptRef} sale={completedSale} />
          </div>
        </section>
      )}
    </form>
  );
}
