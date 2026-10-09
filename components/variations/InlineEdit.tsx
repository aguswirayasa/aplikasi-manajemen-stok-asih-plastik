"use client";

import { useId, useState } from "react";
import { Check, Loader2, X } from "lucide-react";

export function InlineEdit({
  initialValue,
  onSave,
  onCancel,
  placeholder = "Nama...",
}: {
  initialValue: string;
  onSave: (v: string) => Promise<void>;
  onCancel: () => void;
  placeholder?: string;
}) {
  const [val, setVal] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  const handleSave = async () => {
    if (!val.trim() || val.trim() === initialValue) {
      onCancel();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(val.trim());
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Gagal menyimpan perubahan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="inline-flex items-center gap-1.5">
      <input
        autoFocus
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          setError(null);
        }}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleSave();
          }

          if (e.key === "Escape") {
            onCancel();
          }
        }}
        placeholder={placeholder}
        className="w-36 rounded border border-[#ff4f00] bg-[#fffefb] px-2 py-0.5 text-sm text-[#201515] focus:outline-none"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="text-[#ff4f00] transition-colors hover:text-[#cc3f00]"
        title="Simpan"
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
      </button>
      <button
        onClick={onCancel}
        className="text-[#939084] transition-colors hover:text-[#201515]"
        title="Batal"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      </span>
      {error && <span id={errorId} role="alert" className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
