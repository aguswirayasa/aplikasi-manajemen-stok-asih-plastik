"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  Settings2,
  Users,
  LogOut,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";

const mainNavItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Produk", href: "/products", icon: Package },
  { title: "Kasir (Keluar)", href: "/stock/out", icon: ArrowUpFromLine },
];

const adminStockItems = [
  { title: "Barang Masuk", href: "/stock/in", icon: ArrowDownToLine },
  { title: "Riwayat", href: "/stock/history", icon: History },
];

const adminNavItems = [
  { title: "Variasi Global", href: "/variations", icon: Settings2 },
  { title: "Manajemen User", href: "/users", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <aside
      className="hidden md:flex w-60 flex-col min-h-screen sticky top-0 border-r border-[#c5c0b1] bg-[#fffefb]"
      style={{ fontFamily: "Inter, Helvetica, Arial, sans-serif" }}
    >
      {/* Brand */}
      <div className="px-6 py-5 border-b border-[#eceae3]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-[#ff4f00] flex items-center justify-center flex-shrink-0">
            <Package className="w-4 h-4 text-white" />
          </div>
          <span className="text-[15px] font-semibold text-[#201515] tracking-tight">
            Stock System
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#939084]">
          Menu Utama
        </p>
        {mainNavItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#eceae3] text-[#201515]"
                  : "text-[#36342e] hover:bg-[#eceae3] hover:text-[#201515]"
              )}
              style={
                isActive
                  ? { boxShadow: "rgb(255, 79, 0) -3px 0 0 0 inset" }
                  : undefined
              }
            >
              <item.icon
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  isActive ? "text-[#ff4f00]" : "text-[#939084]"
                )}
              />
              {item.title}
            </Link>
          );
        })}

        {isAdmin &&
          adminStockItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#eceae3] text-[#201515]"
                    : "text-[#36342e] hover:bg-[#eceae3] hover:text-[#201515]"
                )}
                style={
                  isActive
                    ? { boxShadow: "rgb(255, 79, 0) -3px 0 0 0 inset" }
                    : undefined
                }
              >
                <item.icon
                  className={cn(
                    "w-4 h-4 flex-shrink-0",
                    isActive ? "text-[#ff4f00]" : "text-[#939084]"
                  )}
                />
                {item.title}
              </Link>
            );
          })}

        {isAdmin && (
          <>
            <p className="px-3 pt-5 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[#939084]">
              Admin
            </p>
            {adminNavItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#eceae3] text-[#201515]"
                      : "text-[#36342e] hover:bg-[#eceae3] hover:text-[#201515]"
                  )}
                  style={
                    isActive
                      ? { boxShadow: "rgb(255, 79, 0) -3px 0 0 0 inset" }
                      : undefined
                  }
                >
                  <item.icon
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      isActive ? "text-[#ff4f00]" : "text-[#939084]"
                    )}
                  />
                  {item.title}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-[#eceae3]">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded bg-[#eceae3] mb-1">
          <div className="w-7 h-7 rounded-full bg-[#201515] flex items-center justify-center text-[#fffefb] text-xs font-bold flex-shrink-0">
            {session?.user?.username?.charAt(0).toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#201515] truncate">
              {session?.user?.username}
            </p>
            <p className="text-[10px] text-[#939084] truncate">
              {session?.user?.role}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-2.5 px-3 py-2 rounded text-sm text-[#939084] hover:bg-[#eceae3] hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Keluar
        </button>
      </div>
    </aside>
  );
}
