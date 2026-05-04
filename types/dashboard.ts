import type { ReactNode } from "react";
import type { getDashboardData } from "@/lib/dashboard-data";

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export type DashboardIcon = ReactNode;

export type LowStockVariant = DashboardData["lowStockVariants"][number];

export type DashboardTransaction = DashboardData["recentTransactions"][number];
