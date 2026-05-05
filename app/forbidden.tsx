import { Home, ShieldAlert } from "lucide-react";
import { ErrorState, ErrorStateLink } from "@/components/ui/error-state";

export default function Forbidden() {
  return (
    <ErrorState
      icon={ShieldAlert}
      eyebrow="403"
      title="Akses ditolak"
      description="Akun Anda tidak memiliki izin untuk membuka halaman khusus admin."
    >
      <ErrorStateLink href="/dashboard">
        <Home className="h-4 w-4" />
        Ke Dashboard
      </ErrorStateLink>
    </ErrorState>
  );
}
