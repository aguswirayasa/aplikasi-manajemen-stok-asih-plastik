"use client";

import { useEffect, useState } from "react";
import { Copy, Link2, Loader2, MessageCircle, Unlink } from "lucide-react";
import { toast } from "sonner";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type TelegramStatus = {
  linked: boolean;
  telegramUsername: string | null;
  telegramLinkedAt: string | null;
};

type TelegramToken = TelegramStatus & {
  token: string;
  command: string;
  expiresAt: string;
  ttlMinutes: number;
};

export function TelegramLinkPanel() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [token, setToken] = useState<TelegramToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadStatus() {
      try {
        const data = await requestTelegramApi<TelegramStatus>(
          "/api/telegram/link-token"
        );

        if (mounted) {
          setStatus(data);
        }
      } catch (error: unknown) {
        toast.error(getErrorMessage(error));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadStatus();

    return () => {
      mounted = false;
    };
  }, []);

  async function generateToken() {
    setSubmitting(true);

    try {
      const data = await requestTelegramApi<TelegramToken>(
        "/api/telegram/link-token",
        { method: "POST" }
      );

      setToken(data);
      setStatus(data);
      toast.success("Kode Telegram berhasil dibuat.");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function unlinkTelegram() {
    setSubmitting(true);

    try {
      const data = await requestTelegramApi<TelegramStatus>(
        "/api/telegram/link-token",
        { method: "DELETE" }
      );

      setStatus(data);
      setToken(null);
      toast.success("Telegram berhasil diputus.");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCommand() {
    if (!token) {
      return;
    }

    try {
      await navigator.clipboard.writeText(token.command);
      toast.success("Perintah link disalin.");
    } catch {
      toast.error("Perintah link tidak bisa disalin otomatis.");
    }
  }

  return (
    <section className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]">
      <div className="flex flex-col gap-3 border-b border-[#c5c0b1] bg-[#eceae3]/35 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] text-[#ff4f00]">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[16px] font-bold text-[#201515]">
              Telegram
            </h2>
            <p className="text-[13px] leading-[1.35] text-[#36342e]">
              Hubungkan akun untuk bot stok dan laporan admin.
            </p>
          </div>
        </div>
        {status?.linked ? (
          <button
            type="button"
            onClick={unlinkTelegram}
            disabled={submitting}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-4 text-[13px] font-bold text-[#201515] transition-colors hover:bg-[#eceae3] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Unlink className="h-4 w-4" />
            Putuskan
          </button>
        ) : (
          <button
            type="button"
            onClick={generateToken}
            disabled={loading || submitting}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-[#ff4f00] bg-[#ff4f00] px-4 text-[13px] font-bold text-[#fffefb] transition-colors hover:bg-[#e64600] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            Buat Kode
          </button>
        )}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-[14px] text-[#939084]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat status Telegram...
          </div>
        ) : status?.linked ? (
          <div className="grid gap-1 text-[14px] text-[#36342e]">
            <p className="font-semibold text-[#201515]">Status: terhubung</p>
            <p>
              Akun Telegram:{" "}
              <span className="font-semibold">
                {status.telegramUsername
                  ? `@${status.telegramUsername}`
                  : "Tanpa username"}
              </span>
            </p>
          </div>
        ) : token ? (
          <div className="grid gap-3">
            <p className="text-[14px] leading-[1.35] text-[#36342e]">
              Kirim perintah ini ke bot Telegram sebelum kode kedaluwarsa.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <code className="min-h-11 flex-1 rounded-[5px] border border-[#c5c0b1] bg-[#eceae3]/35 px-3 py-2 text-[15px] font-bold text-[#201515]">
                {token.command}
              </code>
              <button
                type="button"
                onClick={copyCommand}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-4 text-[13px] font-bold text-[#201515] transition-colors hover:bg-[#eceae3]"
              >
                <Copy className="h-4 w-4" />
                Salin
              </button>
            </div>
            <p className="text-[12px] font-semibold text-[#939084]">
              Berlaku {token.ttlMinutes} menit.
            </p>
          </div>
        ) : (
          <p className="text-[14px] leading-[1.35] text-[#36342e]">
            Belum terhubung. Buat kode dari akun webapp ini, lalu kirim kode ke
            bot Telegram.
          </p>
        )}
      </div>
    </section>
  );
}

async function requestTelegramApi<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error || "Permintaan Telegram gagal.");
  }

  return payload.data;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan.";
}
