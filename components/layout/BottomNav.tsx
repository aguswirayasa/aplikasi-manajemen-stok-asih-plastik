"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  MessageCircle,
  MoreHorizontal,
  Settings2,
  Users,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";

const mobileNavItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Produk", href: "/products", icon: Package },
  { title: "Kasir", href: "/stock/out", icon: ArrowUpFromLine },
  { title: "Masuk", href: "/stock/in", icon: ArrowDownToLine },
  { title: "Riwayat", href: "/stock/history", icon: History },
];

const adminNavItems = [
  { title: "Variasi Global", href: "/variations", icon: Settings2 },
  { title: "Manajemen User", href: "/users", icon: Users },
  { title: "Telegram", href: "/telegram", icon: MessageCircle },
];

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  useEffect(() => {
    if (!isMoreOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMoreOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMoreOpen]);

  if (!session?.user) return null;

  const isAdmin = session.user.role === "ADMIN";
  const isMoreActive = adminNavItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  return (
    <>
      {isAdmin && isMoreOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Tutup menu lainnya"
            className="absolute inset-0 bg-[#201515]/20"
            onClick={() => setIsMoreOpen(false)}
          />
          <div
            id="mobile-admin-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu admin"
            className="absolute bottom-20 left-3 right-3 overflow-hidden rounded border border-[#c5c0b1] bg-[#fffefb] shadow-[0_18px_45px_rgba(32,21,21,0.18)]"
          >
            <div className="flex items-center justify-between border-b border-[#eceae3] px-4 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
                  Menu Admin
                </p>
                <p className="text-sm font-semibold text-[#201515]">
                  Lainnya
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup menu admin"
                className="flex h-9 w-9 items-center justify-center rounded text-[#939084] transition-colors hover:bg-[#eceae3] hover:text-[#201515]"
                onClick={() => setIsMoreOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-1 p-2">
              {adminNavItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded px-3 py-3 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-[#eceae3] text-[#201515]"
                        : "text-[#36342e] hover:bg-[#eceae3] hover:text-[#201515]"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-5 w-5 flex-shrink-0",
                        isActive ? "text-[#ff4f00]" : "text-[#939084]"
                      )}
                    />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-stretch justify-around border-t border-[#c5c0b1] bg-[#fffefb] md:hidden">
        {mobileNavItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
                isActive
                  ? "text-[#ff4f00]"
                  : "text-[#939084] hover:text-[#201515]"
              )}
              style={
                isActive
                  ? { boxShadow: "rgb(255, 79, 0) 0 -3px 0 0 inset" }
                  : undefined
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-semibold">{item.title}</span>
            </Link>
          );
        })}
        {isAdmin && (
          <button
            type="button"
            aria-expanded={isMoreOpen}
            aria-controls="mobile-admin-menu"
            onClick={() => setIsMoreOpen((current) => !current)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
              isMoreActive || isMoreOpen
                ? "text-[#ff4f00]"
                : "text-[#939084] hover:text-[#201515]"
            )}
            style={
              isMoreActive || isMoreOpen
                ? { boxShadow: "rgb(255, 79, 0) 0 -3px 0 0 inset" }
                : undefined
            }
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Lainnya</span>
          </button>
        )}
      </nav>
    </>
  );
}
