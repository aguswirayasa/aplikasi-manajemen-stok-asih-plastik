"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const validToken = typeof token === "string" && /^[a-f0-9]{64}$/i.test(token);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }
    if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
      setError("Password minimal 8 karakter.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        const text =
          typeof result?.error === "string"
            ? result.error
            : "Gagal mereset password. Silakan coba lagi.";
        setError(text);
        toast.error(text);
        return;
      }
      setComplete(true);
      setPassword("");
      setConfirmPassword("");
      window.history.replaceState(null, "", "/reset-password");
      toast.success("Password berhasil direset. Silakan masuk kembali.");
      try {
        await signOut({ redirect: false });
      } catch {
        toast.error("Password sudah direset. Buka login untuk masuk kembali.");
      }
    } catch {
      const text = "Gagal mereset password. Silakan coba lagi.";
      setError(text);
      toast.error(text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fffefb] p-4 text-[#201515] sm:p-8">
      <section className="w-full max-w-[440px] space-y-6 rounded-[5px] border border-[#c5c0b1] p-6 sm:p-10">
        <h1 className="text-[24px] font-semibold tracking-tight text-[#201515]">
          Reset password
        </h1>
        {complete ? (
          <div className="space-y-4">
            <p
              role="status"
              className="rounded-[5px] border border-[#c5c0b1] bg-[#eceae3] px-4 py-3 text-sm leading-relaxed text-[#36342e]"
            >
              Password berhasil direset. Silakan masuk kembali.
            </p>
            <Link
              href="/login"
              className="font-semibold text-[#ff4f00] underline"
            >
              Masuk kembali
            </Link>
          </div>
        ) : !validToken ? (
          <p
            role="alert"
            className="rounded-[5px] border border-[#ff4f00] bg-[#fff7ed] px-4 py-3 text-sm font-semibold leading-[1.4] text-[#9a3412]"
          >
            Tautan reset tidak valid atau sudah kedaluwarsa. Silakan minta
            tautan baru.
          </p>
        ) : (
          <form noValidate onSubmit={submit} className="space-y-5">
            <p id="password-help" className="text-sm text-[#36342e]">
              Password minimal 8 karakter.
            </p>
            <div className="space-y-2">
              <Label
                className="text-[14px] font-semibold tracking-[0.5px] text-[#201515] uppercase"
                htmlFor="new-password"
              >
                Password baru
              </Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(error)}
                aria-describedby={
                  error ? "password-help recovery-error" : "password-help"
                }
                required
                minLength={8}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                disabled={loading}
                className="h-12 rounded-[5px] border-[#c5c0b1] bg-[#fffefb] px-4 text-[16px] text-[#201515] shadow-none placeholder:text-[#939084] focus-visible:border-[#ff4f00] focus-visible:ring-1 focus-visible:ring-[#ff4f00] md:text-[16px]"
              />
            </div>
            <div className="space-y-2">
              <Label
                className="text-[14px] font-semibold tracking-[0.5px] text-[#201515] uppercase"
                htmlFor="confirm-password"
              >
                Konfirmasi password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(error)}
                aria-describedby={
                  error ? "password-help recovery-error" : "password-help"
                }
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setError("");
                }}
                disabled={loading}
                className="h-12 rounded-[5px] border-[#c5c0b1] bg-[#fffefb] px-4 text-[16px] text-[#201515] shadow-none placeholder:text-[#939084] focus-visible:border-[#ff4f00] focus-visible:ring-1 focus-visible:ring-[#ff4f00] md:text-[16px]"
              />
            </div>
            {error && (
              <p
                role="alert"
                id="recovery-error"
                className="rounded-[5px] border border-[#ff4f00] bg-[#fff7ed] px-4 py-3 text-sm font-semibold leading-[1.4] text-[#9a3412]"
              >
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="min-h-12 w-full rounded-[4px] border border-[#ff4f00] bg-[#ff4f00] px-6 text-[16px] font-semibold text-[#fffefb] hover:border-[#e04500] hover:bg-[#e04500] focus-visible:border-[#ff4f00] focus-visible:ring-[#ff4f00]/50"
            >
              {loading ? "Memproses..." : "Simpan password baru"}
            </Button>
          </form>
        )}
        {!complete && (
          <Link
            href="/forgot-password"
            className="block text-sm font-semibold text-[#ff4f00] underline"
          >
            Minta tautan baru
          </Link>
        )}
      </section>
    </main>
  );
}
