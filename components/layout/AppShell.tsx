"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Package } from "lucide-react";

const AUTH_PAGES = ["/login"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div
      className="flex min-h-screen bg-[#fffefb]"
      style={{ fontFamily: "Inter, Helvetica, Arial, sans-serif" }}
    >
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-[#c5c0b1] bg-[#fffefb] sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#ff4f00] flex items-center justify-center">
              <Package className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-[#201515]">
              Stock System
            </span>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 pb-24 md:pb-8">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
