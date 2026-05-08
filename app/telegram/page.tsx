import { MessageCircle } from "lucide-react";
import { TelegramLinkPanel } from "@/components/telegram/TelegramLinkPanel";
import { requirePageAdmin } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function TelegramPage() {
  await requirePageAdmin();

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-[#ff4f00]" />
          <span className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
            Integrasi
          </span>
        </div>
        <div>
          <h1 className="text-[30px] font-semibold leading-[1] text-[#201515] md:text-[36px]">
            Koneksi Telegram
          </h1>
          <p className="mt-2 max-w-[620px] text-[15px] leading-[1.35] text-[#36342e]">
            Sambungkan Telegram agar stok bisa dicek lewat chat dan laporan
            toko bisa masuk langsung ke HP.
          </p>
        </div>
      </header>

      <TelegramLinkPanel />
    </div>
  );
}
