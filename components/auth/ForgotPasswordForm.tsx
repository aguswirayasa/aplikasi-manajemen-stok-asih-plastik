"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!identifier.trim() || identifier.length > 254) {
      setError("Username atau email wajib diisi, maksimal 254 karakter.");
      setMessage("");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        const text = typeof result?.error === "string" ? result.error : "Gagal meminta tautan reset. Silakan coba lagi.";
        setError(text);
        toast.error(text);
        return;
      }
      const text = typeof result?.message === "string" ? result.message : "Jika akun terdaftar dan memiliki email pemulihan, Anda akan menerima tautan reset password.";
      setMessage(text);
      toast.success(text);
    } catch {
      const text = "Gagal meminta tautan reset. Silakan coba lagi.";
      setError(text);
      toast.error(text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fffefb] p-4 text-[#201515] sm:p-8">
      <section className="w-full max-w-[440px] space-y-6 rounded-[5px] border border-[#c5c0b1] p-6 sm:p-10">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#201515]">
            Lupa password?
          </h1>
          <p className="mt-2 text-[15px] text-[#36342e]">
            Admin dan pegawai dapat meminta tautan reset melalui email pemulihan
            yang sudah disimpan.
          </p>
        </div>
        <form noValidate onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-[14px] font-semibold tracking-[0.5px] text-[#201515] uppercase" htmlFor="identifier">Username atau email</Label>
            <Input
              id="identifier"
              autoComplete="username"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "recovery-error" : undefined}
              required
              maxLength={254}
              value={identifier}
              onChange={(event) => { setIdentifier(event.target.value); setError(""); setMessage(""); }}
              disabled={loading}
              className="h-12 rounded-[5px] border-[#c5c0b1] bg-[#fffefb] px-4 text-[16px] text-[#201515] shadow-none placeholder:text-[#939084] focus-visible:border-[#ff4f00] focus-visible:ring-1 focus-visible:ring-[#ff4f00] md:text-[16px]"
            />
          </div>
          {error && (
            <p role="alert" id="recovery-error" className="rounded-[5px] border border-[#ff4f00] bg-[#fff7ed] px-4 py-3 text-sm font-semibold leading-[1.4] text-[#9a3412]">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="rounded-[5px] border border-[#c5c0b1] bg-[#eceae3] px-4 py-3 text-sm leading-relaxed text-[#36342e]">
              {message}
            </p>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="min-h-12 w-full rounded-[4px] border border-[#ff4f00] bg-[#ff4f00] px-6 text-[16px] font-semibold text-[#fffefb] hover:border-[#e04500] hover:bg-[#e04500] focus-visible:border-[#ff4f00] focus-visible:ring-[#ff4f00]/50"
          >
            {loading ? "Memproses..." : "Kirim tautan reset"}
          </Button>
        </form>
        <Link
          href="/login"
          className="block text-sm font-semibold text-[#ff4f00] underline"
        >
          Kembali ke login
        </Link>
      </section>
    </main>
  );
}
