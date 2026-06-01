"use client";

import { useState } from "react";
import { Check, Loader2, Plus, Tags, X } from "lucide-react";
import { toast } from "sonner";

export type VariationValue = { id: string; value: string };
export type VariationType = {
  id: string;
  name: string;
  values: VariationValue[];
};
export type VariationMode = "dengan" | "tanpa";
export type StepDef = { number: number; label: string };

export const STEPS_DENGAN_VARIASI: readonly StepDef[] = [
  { number: 1, label: "Info Produk" },
  { number: 2, label: "Tipe Variasi" },
  { number: 3, label: "Kombinasi SKU" },
  { number: 4, label: "Harga & Stok" },
  { number: 5, label: "Review" },
] as const;

export const STEPS_TANPA_VARIASI: readonly StepDef[] = [
  { number: 1, label: "Info Produk" },
  { number: 2, label: "Tipe Variasi" },
  { number: 4, label: "Harga & Stok" },
  { number: 5, label: "Review" },
] as const;

export function WizardStepIndicator({
  steps,
  currentIndex,
}: {
  steps: readonly StepDef[];
  currentIndex: number;
}) {
  return (
    <div
      className="grid border-b border-[#c5c0b1] bg-[#eceae3]/50"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((stepDef, index) => {
        const isActive = currentIndex === index;
        const isDone = currentIndex > index;

        return (
          <div
            key={stepDef.number}
            className={`border-b-[4px] px-2 py-3 text-center text-[10px] font-medium uppercase md:text-[14px] ${
              isActive
                ? "border-[#ff4f00] bg-[#fffefb] text-[#201515]"
                : isDone
                  ? "border-[#c5c0b1] bg-[#fffefb] text-[#939084]"
                  : "border-transparent text-[#939084]"
            }`}
          >
            {index + 1}. {stepDef.label}
          </div>
        );
      })}
    </div>
  );
}

export function VariationTypeFallback({
  onAddClick,
}: {
  onAddClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#c5c0b1] bg-[#fffefb] py-20 text-center">
      <Tags className="mb-4 h-10 w-10 text-[#c5c0b1]" />
      <h3 className="mb-1 text-base font-semibold text-[#201515]">
        Belum ada tipe variasi
      </h3>
      <p className="mb-6 text-sm text-[#939084]">
        Tambahkan tipe variasi pertama untuk melanjutkan.
      </p>
      <button
        type="button"
        onClick={onAddClick}
        className="flex min-h-10 items-center gap-2 rounded-[4px] bg-[#ff4f00] px-4 text-[14px] font-semibold text-[#fffefb] transition-opacity hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Tambah Tipe Variasi
      </button>
    </div>
  );
}

export function VariationTypeQuickAdd({
  onCreated,
  open: openProp,
  onOpenChange,
}: {
  onCreated: (type: VariationType) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openInternal, setOpenInternal] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const open = openProp !== undefined ? openProp : openInternal;

  const setOpen = (value: boolean) => {
    if (openProp !== undefined) {
      onOpenChange?.(value);
      return;
    }

    setOpenInternal(value);
  };

  const close = () => {
    if (!saving) {
      setName("");
      setError("");
      setOpen(false);
    }
  };

  const handleAdd = async () => {
    const trimmed = name.trim();

    if (trimmed.length === 0) {
      setError("Nama tipe variasi tidak boleh kosong.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/variations/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = (await response.json()) as {
        data?: VariationType;
        error?: string;
      };

      if (!response.ok) {
        toast.error(json.error ?? "Gagal menambah tipe variasi.");
        return;
      }

      if (!json.data) {
        toast.error("Gagal menambah tipe variasi.");
        return;
      }

      onCreated(json.data);
      setName("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[5px] border border-[#ff4f00] px-4 text-[14px] font-semibold text-[#ff4f00] transition-colors hover:bg-[#fff4ed]"
      >
        <Plus className="h-4 w-4" />
        Tambah Tipe Variasi
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex min-h-12 items-center gap-2 rounded-[5px] border border-[#ff4f00] bg-[#fffefb] px-3">
        <input
          autoFocus
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void handleAdd();
            }
            if (event.key === "Escape") {
              close();
            }
          }}
          placeholder="Nama tipe variasi"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-[#201515] outline-none placeholder:text-[#939084]"
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={saving}
          className="rounded p-1.5 text-[#ff4f00] transition-colors hover:bg-[#fff4ed] disabled:opacity-40"
          title="Simpan tipe variasi"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={close}
          disabled={saving}
          className="rounded p-1.5 text-[#939084] transition-colors hover:bg-[#eceae3] hover:text-[#201515] disabled:opacity-40"
          title="Batal"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="text-[13px] text-red-600">{error}</p>}
    </div>
  );
}

export function VariationValueQuickAdd({
  typeId,
  onCreated,
}: {
  typeId: string;
  onCreated: (value: VariationValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    if (!saving) {
      setValue("");
      setError("");
      setOpen(false);
    }
  };

  const handleAdd = async () => {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      setError("Nilai variasi tidak boleh kosong.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/variations/values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: trimmed, variationTypeId: typeId }),
      });
      const json = (await response.json()) as {
        data?: VariationValue;
        error?: string;
      };

      if (!response.ok) {
        toast.error(json.error ?? "Gagal menambah nilai variasi.");
        return;
      }

      if (!json.data) {
        toast.error("Gagal menambah nilai variasi.");
        return;
      }

      onCreated(json.data);
      setValue("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-[20px] border border-dashed border-[#c5c0b1] px-3 text-[13px] font-medium text-[#939084] transition-colors hover:border-[#ff4f00] hover:text-[#ff4f00]"
        title="Tambah nilai variasi baru"
      >
        <Plus className="h-3.5 w-3.5" />
        Tambah nilai
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex min-h-10 items-center gap-2 rounded-[20px] border border-[#ff4f00] bg-[#fffefb] px-3">
        <input
          autoFocus
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void handleAdd();
            }
            if (event.key === "Escape") {
              close();
            }
          }}
          placeholder="Nilai baru"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-[#201515] outline-none placeholder:text-[#939084]"
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={saving}
          className="rounded-full p-1 text-[#ff4f00] transition-colors hover:bg-[#fff4ed] disabled:opacity-40"
          title="Simpan nilai variasi"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={close}
          disabled={saving}
          className="rounded-full p-1 text-[#939084] transition-colors hover:bg-[#eceae3] hover:text-[#201515] disabled:opacity-40"
          title="Batal"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {error && <p className="pl-3 text-[12px] text-red-600">{error}</p>}
    </div>
  );
}

export const getNextStep = (
  currentStep: number,
  mode: VariationMode
): number => {
  if (mode === "tanpa") {
    if (currentStep === 2) return 4;
    if (currentStep === 4) return 5;
    return currentStep + 1;
  }

  return currentStep + 1;
};

export const getPrevStep = (
  currentStep: number,
  mode: VariationMode
): number => {
  if (mode === "tanpa") {
    if (currentStep === 4) return 2;
    if (currentStep === 5) return 4;
    return currentStep - 1;
  }

  return currentStep - 1;
};
