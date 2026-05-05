"use client";

import { useEffect } from "react";
import { Home, RefreshCw, ServerCrash } from "lucide-react";
import {
  ErrorState,
  ErrorStateLink,
  errorStateButtonClassName,
} from "@/components/ui/error-state";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      icon={ServerCrash}
      eyebrow="500"
      title="Terjadi kesalahan server"
      description="Sistem gagal memuat halaman ini. Coba ulangi proses atau kembali ke dashboard."
    >
      <button
        type="button"
        onClick={() => unstable_retry()}
        className={errorStateButtonClassName}
      >
        <RefreshCw className="h-4 w-4" />
        Coba lagi
      </button>
      <ErrorStateLink href="/dashboard" variant="secondary">
        <Home className="h-4 w-4" />
        Ke Dashboard
      </ErrorStateLink>
    </ErrorState>
  );
}
