import { Home, SearchX } from "lucide-react";
import { ErrorState, ErrorStateLink } from "@/components/ui/error-state";

export default function NotFound() {
  return (
    <ErrorState
      icon={SearchX}
      eyebrow="404"
      title="Halaman tidak ditemukan"
      description="Alamat yang dibuka tidak tersedia atau sudah dipindahkan."
    >
      <ErrorStateLink href="/dashboard">
        <Home className="h-4 w-4" />
        Ke Dashboard
      </ErrorStateLink>
    </ErrorState>
  );
}
