"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  MoreHorizontal,
} from "lucide-react";
import { useSession } from "next-auth/react";

const mobileNavItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Produk", href: "/products", icon: Package },
  { title: "Kasir", href: "/stock/out", icon: ArrowUpFromLine },
];

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (!session?.user) return null;

  const isAdmin = session.user.role === "ADMIN";
  const navItems = isAdmin
    ? [
        ...mobileNavItems,
        { title: "Masuk", href: "/stock/in", icon: ArrowDownToLine },
      ]
    : mobileNavItems;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#fffefb] border-t border-[#c5c0b1] flex justify-around items-stretch h-16 z-50">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center flex-1 gap-1 transition-colors",
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
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-semibold">{item.title}</span>
          </Link>
        );
      })}
      <Link
        href="/variations"
        className={cn(
          "flex flex-col items-center justify-center flex-1 gap-1 transition-colors",
          pathname.startsWith("/variations") || pathname.startsWith("/users")
            ? "text-[#ff4f00]"
            : "text-[#939084] hover:text-[#201515]"
        )}
        style={
          pathname.startsWith("/variations") || pathname.startsWith("/users")
            ? { boxShadow: "rgb(255, 79, 0) 0 -3px 0 0 inset" }
            : undefined
        }
      >
        <MoreHorizontal className="w-5 h-5" />
        <span className="text-[10px] font-semibold">Lainnya</span>
      </Link>
    </nav>
  );
}
