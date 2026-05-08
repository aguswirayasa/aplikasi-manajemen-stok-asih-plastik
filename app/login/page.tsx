"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Package } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (res?.error) {
        toast.error("Login gagal. Periksa username dan password.");
      } else {
        toast.success("Login berhasil.");
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      toast.error("Login gagal. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#fffefb] p-4 sm:p-8">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-[8px] bg-[#ff4f00] text-[#fffefb]">
          <Package className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-[32px] uppercase font-bold tracking-tight text-[#201515]">
          Asih Plastik
        </h1>
        <p className="mb-1 text-[13px] font-semibold tracking-[0.5px] text-[#ff4f00] uppercase">
          Manajemen Stok
        </p>
      </div>

      <div className="w-full max-w-[440px] rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] p-6 shadow-none sm:p-10">
        <div className="mb-8">
          <h2 className="text-[24px] font-semibold tracking-tight text-[#201515]">
            Masuk ke akun Anda
          </h2>
          <p className="mt-2 text-[16px] text-[#36342e]">
            Masukkan kredensial untuk melanjutkan.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="username"
              className="block text-[14px] font-semibold tracking-[0.5px] text-[#201515] uppercase"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              placeholder="Masukkan username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-4 py-3 text-[16px] text-[#201515] placeholder:text-[#939084] outline-none transition-colors focus-visible:border-[#ff4f00] focus-visible:ring-1 focus-visible:ring-[#ff4f00]"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-[14px] font-semibold tracking-[0.5px] text-[#201515] uppercase"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="********"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] py-3 pr-12 pl-4 text-[16px] text-[#201515] placeholder:text-[#939084] outline-none transition-colors focus-visible:border-[#ff4f00] focus-visible:ring-1 focus-visible:ring-[#ff4f00]"
              />
              <button
                type="button"
                aria-label={
                  showPassword ? "Sembunyikan password" : "Tampilkan password"
                }
                aria-pressed={showPassword}
                onClick={() => setShowPassword((current) => !current)}
                className="absolute top-1/2 right-3 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[4px] text-[#939084] transition-colors hover:bg-[#f4f0e6] hover:text-[#201515] focus-visible:ring-1 focus-visible:ring-[#ff4f00] focus-visible:outline-none"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Eye className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center rounded-[4px] border border-[#ff4f00] bg-[#ff4f00] px-[24px] py-[16px] text-[16px] font-semibold text-[#fffefb] transition-colors hover:bg-[#e04500] hover:border-[#e04500] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Memproses...
              </>
            ) : (
              "Masuk"
            )}
          </button>
        </form>
      </div>

      <div className="mt-8 text-center">
        <p className="text-[14px] text-[#939084]">
          Copyright © 2026 Asih Plastik. All rights reserved.
        </p>
      </div>
    </div>
  );
}
