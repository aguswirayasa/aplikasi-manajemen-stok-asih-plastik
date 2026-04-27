"use client";

import type { ReactNode } from "react";
import { useState } from "react";

type ConfirmActionProps = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  disabled?: boolean;
  onConfirm: () => Promise<void> | void;
  trigger: (open: () => void) => ReactNode;
};

export function ConfirmAction({
  title,
  message,
  confirmLabel,
  cancelLabel = "Batal",
  disabled = false,
  onConfirm,
  trigger,
}: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const close = () => {
    if (!confirming) {
      setOpen(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      {trigger(() => {
        if (!disabled) {
          setOpen(true);
        }
      })}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-[8px] border border-[#c5c0b1] bg-[#fffefb] p-5 shadow-xl">
            <h2 className="text-[18px] font-bold text-[#201515]">{title}</h2>
            <p className="mt-2 text-[14px] leading-[1.4] text-[#36342e]">
              {message}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={confirming}
                className="min-h-10 rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-4 text-[14px] font-bold text-[#36342e] hover:bg-[#eceae3] disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming}
                className="min-h-10 rounded-[5px] border border-red-600 bg-red-600 px-4 text-[14px] font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {confirming ? "Memproses..." : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
