"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        router.push(res?.url ?? "/dashboard");
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
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-[8px] bg-[#ff4f00] text-[#fffefb]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </div>
        <h1 className="text-[32px] font-semibold tracking-tight text-[#201515]">
          Manajemen Stok
        </h1>
      </div>

      {/* Login Card Container */}
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
            <input
              id="password"
              type="password"
              placeholder="********"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-4 py-3 text-[16px] text-[#201515] placeholder:text-[#939084] outline-none transition-colors focus-visible:border-[#ff4f00] focus-visible:ring-1 focus-visible:ring-[#ff4f00]"
            />
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
          Akses dilindungi berdasarkan role user.
        </p>
      </div>
    </div>
  );
}
