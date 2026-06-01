"use client";

import { Printer } from "lucide-react";

export function StockHistoryReportActions() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-[#ff4f00] bg-[#ff4f00] px-4 text-[13px] font-bold text-[#fffefb] hover:bg-[#e64600]"
    >
      <Printer className="h-4 w-4" />
      Cetak / Simpan PDF
    </button>
  );
}
